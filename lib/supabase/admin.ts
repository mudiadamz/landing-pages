import { createClient } from "@supabase/supabase-js";
import { dbClient } from "@/lib/backend/db";
import { storageClient } from "@/lib/backend/storage";

/**
 * Service-role client for server-side operations that bypass RLS
 * (e.g. payment callbacks, admin actions). Every use needs its own
 * authorization gate — see CLAUDE.md.
 *
 * `.from()` / `.rpc()` run as SQL under the `service_role` Postgres role, and
 * `.storage` is the server's own disk with every rule bypassed
 * (lib/backend, docs/plans/remove-supabase.md fases 1–2). `.auth.admin` is
 * still Supabase's until fase 3, which is the only reason
 * SUPABASE_SERVICE_ROLE_KEY is still needed.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set for admin operations");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = dbClient(() => "service_role");
  return { auth: supabase.auth, storage: storageClient(() => "service_role"), from: db.from, rpc: db.rpc };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
