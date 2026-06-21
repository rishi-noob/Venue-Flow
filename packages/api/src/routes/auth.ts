import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { eq, and, isNull } from "drizzle-orm";
import { getDb, users } from "@venue-flow/db";
import { loginSchema } from "@venue-flow/shared";
import { signToken, getRedirectUrl } from "../lib/jwt.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/v1/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        status: "error",
        message: parsed.error.errors[0]?.message || "Invalid request",
        error_code: "VALIDATION_ERROR",
      });
    }

    const db = getDb();

    if (parsed.data.login_type === "password") {
      const { email, password } = parsed.data;
      const user = await db.query.users.findFirst({
        where: and(eq(users.email, email.toLowerCase()), eq(users.status, "active")),
      });

      if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return reply.status(401).send({
          status: "error",
          message: "Invalid email or password",
          error_code: "AUTH_INVALID_CREDENTIALS",
        });
      }

      const { token, expiresIn } = signToken({
        userId: user.userId,
        email: user.email,
        role: user.role,
        accountType: user.accountType,
        organizationId: user.organizationId,
        eventIdRestricted: user.eventIdRestricted,
        expiresAt: user.expiresAt?.toISOString() ?? null,
      });

      return reply.send({
        user_id: user.userId,
        email: user.email,
        role: user.role,
        account_type: user.accountType,
        event_id: user.eventIdRestricted,
        expires_at: user.expiresAt?.toISOString(),
        token,
        token_expires_in: expiresIn,
        redirect_url: getRedirectUrl(user.role),
      });
    }

    // Temporary PIN login
    const { pin, email } = parsed.data;
    const tempUsers = await db.query.users.findMany({
      where: and(
        eq(users.accountType, "temporary"),
        eq(users.role, "volunteer"),
        eq(users.status, "active"),
        isNull(users.passwordHash)
      ),
    });

    let matchedUser = null;
    for (const user of tempUsers) {
      if (user.temporaryPinHash && (await bcrypt.compare(pin, user.temporaryPinHash))) {
        if (email && user.email.toLowerCase() !== email.toLowerCase()) continue;
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return reply.status(401).send({
        status: "error",
        message: "Invalid PIN or email",
        error_code: "AUTH_INVALID_CREDENTIALS",
      });
    }

    if (matchedUser.expiresAt && matchedUser.expiresAt < new Date()) {
      return reply.status(410).send({
        status: "error",
        message: "Your temporary access has expired",
        error_code: "AUTH_TEMPORARY_EXPIRED",
        expires_at: matchedUser.expiresAt.toISOString(),
      });
    }

    const { token, expiresIn } = signToken({
      userId: matchedUser.userId,
      email: matchedUser.email,
      role: matchedUser.role,
      accountType: matchedUser.accountType,
      organizationId: matchedUser.organizationId,
      eventIdRestricted: matchedUser.eventIdRestricted,
      expiresAt: matchedUser.expiresAt?.toISOString() ?? null,
    });

    return reply.send({
      user_id: matchedUser.userId,
      email: matchedUser.email,
      role: matchedUser.role,
      account_type: matchedUser.accountType,
      event_id: matchedUser.eventIdRestricted,
      expires_at: matchedUser.expiresAt?.toISOString(),
      token,
      token_expires_in: expiresIn,
      redirect_url: "/scanner",
    });
  });

  app.post("/v1/auth/logout", async (_request, reply) => {
    return reply.send({ status: "ok", message: "Logged out" });
  });
}
