import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  getDb,
  events,
  attendees,
  tickets,
  scanLogs,
} from "@venue-flow/db";
import { scanValidateSchema, computeValidityWindow } from "@venue-flow/shared";
import { authenticate, requireRoles } from "../plugins/auth.js";

export async function scannerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRoles("volunteer"));

  app.post("/v1/scanner/validate", {
    config: { rateLimit: { max: 1000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const parsed = scanValidateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        status: "invalid",
        message: "Invalid ticket ID",
        display: "❌ RED",
        error_code: "VALIDATION_ERROR",
      });
    }

    const { ticket_id, event_id: bodyEventId } = parsed.data;
    const db = getDb();
    const volunteer = request.user!;

    // Volunteer event scope check
    if (volunteer.eventIdRestricted) {
      const scopedEventId = volunteer.eventIdRestricted;
      if (bodyEventId && bodyEventId !== scopedEventId) {
        return reply.status(403).send({
          status: "invalid",
          message: "You can only scan for your assigned event",
          display: "❌ RED",
          error_code: "EVENT_SCOPE_MISMATCH",
        });
      }
    }

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.ticketId, ticket_id),
      with: {
        attendee: true,
        event: true,
      },
    });

    const scanIp = request.ip;

    if (!ticket || !ticket.attendee || !ticket.event) {
      return reply.status(404).send({
        ticket_id,
        status: "invalid",
        message: "Invalid QR code",
        display: "❌ RED",
      });
    }

    const eventId = ticket.eventId;

    if (volunteer.eventIdRestricted && volunteer.eventIdRestricted !== eventId) {
      return reply.status(403).send({
        status: "invalid",
        message: "You can only scan for your assigned event",
        display: "❌ RED",
        error_code: "EVENT_SCOPE_MISMATCH",
      });
    }

    const validity = computeValidityWindow(ticket.event.eventDate, ticket.event.validityDays);
    const now = new Date();

    if (now >= validity.validUntil) {
      await db.insert(scanLogs).values({
        ticketId: ticket.ticketId,
        eventId,
        volunteerId: volunteer.userId,
        scanStatus: "expired",
        scanIp,
      });

      const endDate = validity.validUntil.toISOString().split("T")[0];
      return reply.status(422).send({
        ticket_id,
        status: "expired",
        message: `QR Expired — Validity ended ${endDate}`,
        attendee_name: ticket.attendee.name,
        display: "❌ RED",
      });
    }

    if (ticket.status === "scanned" && ticket.scannedAt) {
      await db.insert(scanLogs).values({
        ticketId: ticket.ticketId,
        eventId,
        volunteerId: volunteer.userId,
        scanStatus: "duplicate",
        scanIp,
      });

      const time = ticket.scannedAt.toISOString().split("T")[1]?.slice(0, 5) ?? "";
      return reply.status(422).send({
        ticket_id,
        status: "duplicate",
        message: `Already Scanned — ${ticket.attendee.name} checked in at ${time}`,
        attendee_name: ticket.attendee.name,
        scanned_at_previous: ticket.scannedAt.toISOString(),
        display: "❌ RED",
      });
    }

    // Atomic conditional update — first scan wins
    const [updated] = await db
      .update(tickets)
      .set({
        status: "scanned",
        scannedAt: now,
        scannedByVolunteerId: volunteer.userId,
      })
      .where(and(eq(tickets.ticketId, ticket_id), eq(tickets.status, "created")))
      .returning();

    if (!updated) {
      const current = await db.query.tickets.findFirst({
        where: eq(tickets.ticketId, ticket_id),
        with: { attendee: true },
      });

      await db.insert(scanLogs).values({
        ticketId: ticket_id,
        eventId,
        volunteerId: volunteer.userId,
        scanStatus: "duplicate",
        scanIp,
      });

      const time = current?.scannedAt?.toISOString().split("T")[1]?.slice(0, 5) ?? "";
      return reply.status(422).send({
        ticket_id,
        status: "duplicate",
        message: `Already Scanned — ${current?.attendee?.name ?? "Attendee"} checked in at ${time}`,
        attendee_name: current?.attendee?.name,
        scanned_at_previous: current?.scannedAt?.toISOString(),
        display: "❌ RED",
      });
    }

    await db
      .update(attendees)
      .set({ status: "scanned", updatedAt: now })
      .where(eq(attendees.attendeeId, ticket.attendeeId));

    await db.insert(scanLogs).values({
      ticketId: ticket.ticketId,
      eventId,
      volunteerId: volunteer.userId,
      scanStatus: "success",
      scanIp,
    });

    return reply.send({
      ticket_id,
      status: "success",
      message: "Entry Granted",
      attendee_name: ticket.attendee.name,
      scanned_at: updated.scannedAt!.toISOString(),
      display: "✅ GREEN",
    });
  });
}
