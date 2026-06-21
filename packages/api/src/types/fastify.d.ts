import type { JwtPayload } from "@venue-flow/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
