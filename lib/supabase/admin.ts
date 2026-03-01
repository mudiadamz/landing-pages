import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-side operations that bypass RLS
 * (e.g. payment callbacks, admin actions). Only use in API routes.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set for admin operations");
  }

  return createClient(url, key);
}
