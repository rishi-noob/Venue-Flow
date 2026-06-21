import type { FastifyInstance } from "fastify";
import { eq, and, isNull, ilike, desc, sql } from "drizzle-orm";
import { getDb, events, attendees, tickets } from "@venue-flow/db";
import { createEventSchema, computeValidityWindow } from "@venue-flow/shared";
import { authenticate, requireRoles } from "../plugins/auth.js";

export async function eventRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/v1/events", {
    preHandler: [requireRoles("admin", "organizer")],
  }, async (request, reply) => {
    const parsed = createEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        status: "error",
        message: parsed.error.errors[0]?.message || "Validation failed",
        error_code: "VALIDATION_ERROR",
      });
    }

    const db = getDb();
    const { event_name, event_date, validity_days } = parsed.data;

    const [event] = await db
      .insert(events)
      .values({
        organizationId: request.user!.organizationId,
        eventName: event_name,
        eventDate: event_date,
        validityDays: validity_days,
        status: "active",
        createdBy: request.user!.userId,
      })
      .returning();

    const validity = computeValidityWindow(event_date, validity_days);

    return reply.status(201).send({
      event_id: event.eventId,
      event_name: event.eventName,
      event_date: event.eventDate,
      validity_days: event.validityDays,
      valid_from: validity.validFrom.toISOString(),
      valid_until: validity.validUntil.toISOString(),
      status: event.status,
      message: "Event created successfully",
    });
  });

  app.get("/v1/events", {
    preHandler: [requireRoles("admin", "organizer")],
  }, async (request, reply) => {
    const db = getDb();
    const { status, search } = request.query as { status?: string; search?: string };

    const conditions = [isNull(events.deletedAt)];
    if (status) conditions.push(eq(events.status, status as "draft" | "active" | "ended" | "archived"));
    if (search) conditions.push(ilike(events.eventName, `%${search}%`));

    const rows = await db
      .select({
        eventId: events.eventId,
        eventName: events.eventName,
        eventDate: events.eventDate,
        validityDays: events.validityDays,
        status: events.status,
        createdAt: events.createdAt,
        attendeeCount: sql<number>`cast(count(distinct ${attendees.attendeeId}) as int)`,
        scannedCount: sql<number>`cast(count(distinct case when ${tickets.status} = 'scanned' then ${tickets.ticketId} end) as int)`,
      })
      .from(events)
      .leftJoin(attendees, and(eq(attendees.eventId, events.eventId), isNull(attendees.deletedAt)))
      .leftJoin(tickets, eq(tickets.attendeeId, attendees.attendeeId))
      .where(and(...conditions))
      .groupBy(events.eventId)
      .orderBy(desc(events.eventDate));

    return reply.send({ events: rows });
  });

  app.get("/v1/events/:eventId", {
    preHandler: [requireRoles("admin", "organizer")],
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const db = getDb();

    const event = await db.query.events.findFirst({
      where: and(eq(events.eventId, eventId), isNull(events.deletedAt)),
    });

    if (!event) {
      return reply.status(404).send({
        status: "error",
        message: "Event not found",
        error_code: "EVENT_NOT_FOUND",
      });
    }

    const [stats] = await db
      .select({
        total: sql<number>`cast(count(distinct ${attendees.attendeeId}) as int)`,
        scanned: sql<number>`cast(count(distinct case when ${tickets.status} = 'scanned' then ${tickets.ticketId} end) as int)`,
      })
      .from(attendees)
      .leftJoin(tickets, eq(tickets.attendeeId, attendees.attendeeId))
      .where(and(eq(attendees.eventId, eventId), isNull(attendees.deletedAt)));

    const validity = computeValidityWindow(event.eventDate, event.validityDays);

    return reply.send({
      ...event,
      valid_from: validity.validFrom.toISOString(),
      valid_until: validity.validUntil.toISOString(),
      stats: {
        total_attendees: stats?.total ?? 0,
        scanned: stats?.scanned ?? 0,
        no_show: (stats?.total ?? 0) - (stats?.scanned ?? 0),
      },
    });
  });
}
