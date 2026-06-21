import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function createDb(connectionString: string) {
  client = postgres(connectionString, {
    ssl: connectionString.includes("neon.tech") ? "require" : "prefer",
    max: 10,
  });
  db = drizzle(client, { schema });
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call createDb() first.");
  }
  return db;
}

export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

export * from "./schema.js";
