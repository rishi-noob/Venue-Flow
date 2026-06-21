import type { FastifyInstance } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { getDb, events, users } from "@venue-flow/db";
import {
  createTempVolunteerSchema,
  createPermanentVolunteerSchema,
  computeValidityWindow,
} from "@venue-flow/shared";
import { authenticate, requireRoles } from "../plugins/auth.js";

function generatePin(): string {
  return randomInt(100000, 999999).toString();
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[randomInt(0, chars.length)];
  }
  return pwd;
}

export async function volunteerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/v1/events/:eventId/volunteers", {
    preHandler: [requireRoles("admin", "organizer")],
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const parsed = createTempVolunteerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        status: "error",
        message: parsed.error.errors[0]?.message || "Validation failed",
        error_code: "VALIDATION_ERROR",
      });
    }

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

    const pin = generatePin();
    const pinHash = await bcrypt.hash(pin, 10);

    const validity = computeValidityWindow(event.eventDate, event.validityDays);
    const defaultExpiry = new Date(validity.validUntil);
    defaultExpiry.setUTCHours(22, 0, 0, 0);

    const expiresAt = parsed.data.expires_at
      ? new Date(parsed.data.expires_at)
      : defaultExpiry;

    const email =
      parsed.data.email?.toLowerCase() ||
      `temp-${pin}@volunteer.local`;

    const [volunteer] = await db
      .insert(users)
      .values({
        organizationId: request.user!.organizationId,
        email,
        name: parsed.data.name,
        role: "volunteer",
        accountType: "temporary",
        temporaryPinHash: pinHash,
        eventIdRestricted: eventId,
        expiresAt,
        passwordHash: null,
      })
      .returning();

    return reply.status(201).send({
      user_id: volunteer.userId,
      name: volunteer.name,
      email: volunteer.email,
      temporary_pin: pin,
      event_id: eventId,
      expires_at: expiresAt.toISOString(),
      message: `PIN: ${pin} — Share with ${parsed.data.name}; expires ${expiresAt.toISOString()}`,
    });
  });

  app.post("/v1/users/volunteers", {
    preHandler: [requireRoles("admin")],
  }, async (request, reply) => {
    const parsed = createPermanentVolunteerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        status: "error",
        message: parsed.error.errors[0]?.message || "Validation failed",
        error_code: "VALIDATION_ERROR",
      });
    }

    const db = getDb();
    const tempPassword = generatePassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const [volunteer] = await db
      .insert(users)
      .values({
        organizationId: request.user!.organizationId,
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        role: "volunteer",
        accountType: "permanent",
        passwordHash,
      })
      .returning();

    return reply.status(201).send({
      user_id: volunteer.userId,
      email: volunteer.email,
      temporary_password: tempPassword,
      message: `Send ${volunteer.email} this password: ${tempPassword}. They can login to Scanner app anytime.`,
    });
  });
}
