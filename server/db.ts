import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// pool/db stay null without DATABASE_URL — the app then uses JSON-file storage.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Neon can close connections from its side (database restart, scale-to-zero,
// network blip). If that hits a connection idling in the pool, the pool emits
// "error" — and an "error" event nobody listens to crashes the whole server.
// Log it instead: the pool has already dropped that connection and opens a
// fresh one on the next query.
pool?.on("error", (err) => {
  console.error("Postgres connection closed by the server:", err.message);
});

export const db = pool ? drizzle(pool) : null;

export function requireDb() {
  if (!db) {
    throw new Error("DATABASE_URL is not set — Postgres storage is unavailable.");
  }
  return db;
}
