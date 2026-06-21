import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "../lib/jwt.js";
import type { JwtPayload, UserRole } from "@venue-flow/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.status(401).send({
      status: "error",
      message: "Missing or invalid authorization token",
      error_code: "AUTH_MISSING_TOKEN",
    });
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);

    if (payload.accountType === "temporary" && payload.expiresAt) {
      if (new Date(payload.expiresAt) < new Date()) {
        return reply.status(410).send({
          status: "error",
          message: "Your temporary access has expired. Contact the organizer.",
          error_code: "AUTH_TEMPORARY_EXPIRED",
          expires_at: payload.expiresAt,
        });
      }
    }

    request.user = payload;
  } catch {
    return reply.status(401).send({
      status: "error",
      message: "Invalid or expired token",
      error_code: "AUTH_INVALID_TOKEN",
    });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        status: "error",
        message: "Unauthorized",
        error_code: "AUTH_UNAUTHORIZED",
      });
    }
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        status: "error",
        message: "You do not have permission for this action",
        error_code: "AUTH_FORBIDDEN",
      });
    }
  };
}
