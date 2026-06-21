import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) {
  config({ path: rootEnv });
} else {
  config();
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
