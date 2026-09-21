import { createClient } from "@supabase/supabase-js";
import { dbClient } from "@/lib/backend/db";

/**
 * Service-role client for server-side operations that bypass RLS
 * (e.g. payment callbacks, admin actions). Every use needs its own
 * authorization gate — see CLAUDE.md.
 *
 * `.from()` / `.rpc()` run as SQL under the `service_role` Postgres role
 * (lib/backend, docs/plans/remove-supabase.md fase 1). `.auth.admin` and
 * `.storage` are still Supabase's until fases 2 and 3, which is the only
 * reason SUPABASE_SERVICE_ROLE_KEY is still needed.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set for admin operations");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = dbClient(() => "service_role");
  return { auth: supabase.auth, storage: supabase.storage, from: db.from, rpc: db.rpc };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
