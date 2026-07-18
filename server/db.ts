import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// pool/db stay null without DATABASE_URL — the app then uses JSON-file storage.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool ? drizzle(pool) : null;

export function requireDb() {
  if (!db) {
    throw new Error("DATABASE_URL is not set — Postgres storage is unavailable.");
  }
  return db;
}
