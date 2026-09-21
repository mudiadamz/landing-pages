import pg from "pg";

/**
 * One connection pool per process, straight to Postgres.
 *
 * This replaces PostgREST as the way the app reaches its data (see
 * docs/plans/remove-supabase.md, fase 1). Kept on globalThis so Next's dev
 * server, which re-evaluates modules on every edit, does not open a new pool
 * each time and exhaust the database's connection limit.
 */

declare global {
  var __lpPool: pg.Pool | undefined;
}

export function pool(): pg.Pool {
  if (!globalThis.__lpPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL belum diset — lihat .env.example.");
    }
    globalThis.__lpPool = new pg.Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // A connection that hangs must not hang a page render forever.
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis.__lpPool;
}

/** For tests and scripts that need to point the pool somewhere explicit. */
export async function resetPool(connectionString?: string): Promise<void> {
  const old = globalThis.__lpPool;
  globalThis.__lpPool = undefined;
  if (connectionString) process.env.DATABASE_URL = connectionString;
  await old?.end();
}
