import "../load-env.js";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(connectionString, {
  ssl: connectionString.includes("neon.tech") ? "require" : "prefer",
  max: 1,
});
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...");

  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "Russian House" })
    .onConflictDoNothing()
    .returning();

  let organizationId = org?.organizationId;
  if (!organizationId) {
    const existing = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, "Russian House"),
    });
    organizationId = existing!.organizationId;
  }

  const passwordHash = await bcrypt.hash("admin123", 10);

  const seedUsers = [
    {
      organizationId,
      email: "admin@russianhouse.com",
      passwordHash,
      name: "System Admin",
      role: "admin" as const,
      accountType: "permanent" as const,
    },
    {
      organizationId,
      email: "organizer@russianhouse.com",
      passwordHash: await bcrypt.hash("organizer123", 10),
      name: "Event Organizer",
      role: "organizer" as const,
      accountType: "permanent" as const,
    },
    {
      organizationId,
      email: "volunteer@russianhouse.com",
      passwordHash: await bcrypt.hash("volunteer123", 10),
      name: "Permanent Volunteer",
      role: "volunteer" as const,
      accountType: "permanent" as const,
    },
  ];

  for (const user of seedUsers) {
    await db
      .insert(schema.users)
      .values(user)
      .onConflictDoNothing({ target: schema.users.email });
  }

  const configDefaults = [
    { configKey: "max_attendees_per_event", configValue: "500" },
    { configKey: "qr_validity_days_default", configValue: "1" },
    { configKey: "scan_rate_limit_per_min", configValue: "1000" },
  ];

  for (const row of configDefaults) {
    await db.insert(schema.config).values(row).onConflictDoNothing();
  }

  console.log("Seed complete.");
  console.log("");
  console.log("Default accounts:");
  console.log("  Admin:     admin@russianhouse.com / admin123");
  console.log("  Organizer: organizer@russianhouse.com / organizer123");
  console.log("  Volunteer: volunteer@russianhouse.com / volunteer123");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
