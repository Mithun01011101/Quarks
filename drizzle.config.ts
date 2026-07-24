import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Load it into the shell before running db:push (drizzle-kit does not read .env).");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // connect-pg-simple owns the session table — never let push touch/drop it.
  tablesFilter: ["!session"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
