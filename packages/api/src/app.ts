import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";
import { eventRoutes } from "./routes/events.js";
import { attendeeRoutes } from "./routes/attendees.js";
import { scannerRoutes } from "./routes/scanner.js";
import { volunteerRoutes } from "./routes/volunteers.js";
import { reportRoutes } from "./routes/reports.js";

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    trustProxy: true,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  const corsOrigins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()) ?? [
    "http://localhost:5173",
    "http://localhost:5174",
  ];

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  });

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes);
  await app.register(eventRoutes);
  await app.register(attendeeRoutes);
  await app.register(scannerRoutes);
  await app.register(volunteerRoutes);
  await app.register(reportRoutes);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.status(500).send({
      status: "error",
      message: "System temporarily unavailable — Try again in 30 seconds",
      error_code: "INTERNAL_ERROR",
    });
  });

  return app;
}
