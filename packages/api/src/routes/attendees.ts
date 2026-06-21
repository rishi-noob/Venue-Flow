import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { getDb, events, attendees, tickets, idempotencyKeys } from "@venue-flow/db";
import { createAttendeeSchema, computeValidityWindow } from "@venue-flow/shared";
import { authenticate, requireRoles } from "../plugins/auth.js";
import { generateQrImage } from "../lib/qr.js";

export async function attendeeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/v1/events/:eventId/attendees", {
    preHandler: [requireRoles("admin", "organizer")],
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const requestId = request.headers["x-request-id"] as string | undefined;
    const db = getDb();

    if (requestId) {
      const cached = await db.query.idempotencyKeys.findFirst({
        where: eq(idempotencyKeys.requestId, requestId),
      });
      if (cached && cached.expiresAt > new Date()) {
        return reply.status(cached.statusCode).send(JSON.parse(cached.responseBody));
      }
    }

    const parsed = createAttendeeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        status: "error",
        message: "Name and Email are required",
        error_code: "VALIDATION_ERROR",
      });
    }

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

    const existing = await db.query.attendees.findFirst({
      where: and(
        eq(attendees.eventId, eventId),
        eq(attendees.email, parsed.data.email.toLowerCase()),
        isNull(attendees.deletedAt)
      ),
    });
    if (existing) {
      return reply.status(409).send({
        status: "error",
        message: "Email already registered for this event",
        error_code: "DUPLICATE_EMAIL",
        attendee_id: existing.attendeeId,
      });
    }

    const allAttendees = await db.query.attendees.findMany({
      where: and(eq(attendees.eventId, eventId), isNull(attendees.deletedAt)),
    });
    if (allAttendees.length >= 500) {
      return reply.status(400).send({
        status: "error",
        message: "Maximum attendees per event (500) reached",
        error_code: "MAX_ATTENDEES",
      });
    }

    const [attendee] = await db
      .insert(attendees)
      .values({
        eventId,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        mobile: parsed.data.mobile,
        location: parsed.data.location,
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        attendeeId: attendee.attendeeId,
        eventId,
      })
      .returning();

    const qrImage = await generateQrImage({
      ticket_id: ticket.ticketId,
      event_id: eventId,
    });

    const validity = computeValidityWindow(event.eventDate, event.validityDays);

    const response = {
      attendee_id: attendee.attendeeId,
      ticket_id: ticket.ticketId,
      name: attendee.name,
      email: attendee.email,
      qr_code_image: qrImage,
      valid_from: validity.validFrom.toISOString(),
      valid_until: validity.validUntil.toISOString(),
      message: `QR generated for ${attendee.name}`,
    };

    if (requestId) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await db.insert(idempotencyKeys).values({
        requestId,
        responseBody: JSON.stringify(response),
        statusCode: 201,
        expiresAt,
      });
    }

    return reply.status(201).send(response);
  });

  app.get("/v1/events/:eventId/attendees", {
    preHandler: [requireRoles("admin", "organizer")],
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const db = getDb();

    const rows = await db
      .select({
        attendeeId: attendees.attendeeId,
        name: attendees.name,
        email: attendees.email,
        mobile: attendees.mobile,
        location: attendees.location,
        status: attendees.status,
        createdAt: attendees.createdAt,
        ticketId: tickets.ticketId,
        ticketStatus: tickets.status,
        scannedAt: tickets.scannedAt,
      })
      .from(attendees)
      .leftJoin(tickets, eq(tickets.attendeeId, attendees.attendeeId))
      .where(and(eq(attendees.eventId, eventId), isNull(attendees.deletedAt)))
      .orderBy(attendees.createdAt);

    return reply.send({ attendees: rows });
  });

  app.get("/v1/events/:eventId/attendees/:attendeeId/qr", {
    preHandler: [requireRoles("admin", "organizer")],
  }, async (request, reply) => {
    const { eventId, attendeeId } = request.params as { eventId: string; attendeeId: string };
    const db = getDb();

    const ticket = await db.query.tickets.findFirst({
      where: and(eq(tickets.eventId, eventId), eq(tickets.attendeeId, attendeeId)),
    });

    if (!ticket) {
      return reply.status(404).send({
        status: "error",
        message: "Ticket not found",
        error_code: "TICKET_NOT_FOUND",
      });
    }

    const qrImage = await generateQrImage({
      ticket_id: ticket.ticketId,
      event_id: eventId,
    });

    return reply.send({ ticket_id: ticket.ticketId, qr_code_image: qrImage });
  });
}
