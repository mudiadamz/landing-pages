import { dbClient } from "@/lib/backend/db";
import { storageClient } from "@/lib/backend/storage";
import type { Who } from "@/lib/backend/rls";
import { currentUser } from "@/lib/auth/session";

/**
 * The per-request client: the signed-in user's view of the data.
 *
 * `.from()` / `.rpc()` run as SQL in lib/backend, as the Postgres role
 * PostgREST would have used, so every RLS policy applies exactly as before
 * (docs/plans/remove-supabase.md, fase 1). `.storage` is the server's own disk,
 * under the same rules the storage.objects policies enforced (fase 2).
 * `.auth.getUser()` keeps supabase-js's shape for its ±80 callers, but answers
 * from the app's own session (fase 3): the httpOnly cookie, looked up in
 * app_auth.sessions once per request.
 */
export async function createClient() {
  const who = async (): Promise<Who> => {
    const user = await currentUser();
    return user ? { uid: user.id } : "anon";
  };
  const auth = {
    async getUser() {
      return { data: { user: await currentUser() }, error: null };
    },
  };

  const db = dbClient(who);
  return { auth, storage: storageClient(who), from: db.from, rpc: db.rpc };
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;
