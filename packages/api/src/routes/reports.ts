import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { getDb, events, attendees, tickets } from "@venue-flow/db";
import { slugify } from "@venue-flow/shared";
import { authenticate, requireRoles } from "../plugins/auth.js";

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/v1/events/:eventId/attendance.csv", {
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

    const rows = await db
      .select({
        attendeeId: attendees.attendeeId,
        name: attendees.name,
        email: attendees.email,
        mobile: attendees.mobile,
        location: attendees.location,
        scannedAt: tickets.scannedAt,
        ticketStatus: tickets.status,
      })
      .from(attendees)
      .leftJoin(tickets, eq(tickets.attendeeId, attendees.attendeeId))
      .where(and(eq(attendees.eventId, eventId), isNull(attendees.deletedAt)))
      .orderBy(attendees.name);

    const header = "attendee_id,name,email,mobile,location,status,scanned_at";
    const lines = rows.map((row) => {
      const status = row.ticketStatus === "scanned" ? "scanned" : "no-show";
      return [
        row.attendeeId,
        escapeCsv(row.name),
        escapeCsv(row.email),
        escapeCsv(row.mobile),
        escapeCsv(row.location),
        status,
        row.scannedAt?.toISOString() ?? "",
      ].join(",");
    });

    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const filename = `${slugify(event.eventName)}_${event.eventDate}_attendance.csv`;

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(csv);
  });
}
