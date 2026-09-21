import { dbClient, type DbClient } from "@/lib/backend/db";

/**
 * Reads as a logged-out visitor, with no cookies involved.
 *
 * This is the client for `unstable_cache`d readers (site settings, pages,
 * role permissions, site resolution) — a cookie-based client cannot be used
 * inside a cache, and a cached answer must not depend on who asked. It runs as
 * the `anon` role, so RLS gives it exactly what a visitor may see.
 *
 * Replaces ~25 places that each built their own supabase-js client from the
 * anon key.
 */
export function createAnonClient(): DbClient {
  return dbClient(() => "anon");
}
