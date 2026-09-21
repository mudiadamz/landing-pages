import { dbClient } from "@/lib/backend/db";
import { storageClient } from "@/lib/backend/storage";

/**
 * Service-role client for server-side operations that bypass RLS
 * (e.g. payment callbacks, admin actions). Every use needs its own
 * authorization gate — see CLAUDE.md.
 *
 * `.from()` / `.rpc()` run as SQL under the `service_role` Postgres role, and
 * `.storage` is the server's own disk with every rule bypassed (lib/backend,
 * docs/plans/remove-supabase.md). Account operations — ban, delete — are plain
 * functions in lib/backend/auth.ts.
 */
export function createAdminClient() {
  const db = dbClient(() => "service_role");
  return { storage: storageClient(() => "service_role"), from: db.from, rpc: db.rpc };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
