import "../load-env.js";
import { createDb, closeDb, getDb, events, users, idempotencyKeys } from "@venue-flow/db";
import { eq, and, lt } from "drizzle-orm";
import { buildApp } from "./app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET not set — using insecure default for development");
  process.env.JWT_SECRET = "dev-secret-change-in-production";
}

createDb(DATABASE_URL);

async function runCronJobs() {
  const db = getDb();
  const now = new Date();

  // End events whose validity window has passed
  const activeEvents = await db.query.events.findMany({
    where: eq(events.status, "active"),
  });
  for (const event of activeEvents) {
    const end = new Date(`${event.eventDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + event.validityDays);
    if (now >= end) {
      await db
        .update(events)
        .set({ status: "ended", updatedAt: now })
        .where(eq(events.eventId, event.eventId));
    }
  }

  // Cleanup expired temp volunteer accounts
  await db
    .delete(users)
    .where(and(eq(users.accountType, "temporary"), lt(users.expiresAt, now)));

  // Cleanup expired idempotency keys
  await db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, now));
}

const app = await buildApp();

app.addHook("onReady", () => {
  setInterval(runCronJobs, 60 * 60 * 1000);
  runCronJobs().catch(console.error);
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`API running on http://0.0.0.0:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

process.on("SIGTERM", async () => {
  await app.close();
  await closeDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await app.close();
  await closeDb();
  process.exit(0);
});
