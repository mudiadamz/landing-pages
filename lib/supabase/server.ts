import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { dbClient } from "@/lib/backend/db";
import type { Who } from "@/lib/backend/rls";

/**
 * The per-request client: the signed-in user's view of the data.
 *
 * `.from()` / `.rpc()` no longer go through PostgREST — they run as SQL in
 * lib/backend, as the same Postgres role PostgREST would have used, so every
 * RLS policy applies exactly as before (docs/plans/remove-supabase.md, fase 1).
 * `.auth` and `.storage` are still Supabase's until fases 2 and 3.
 *
 * Who the caller is comes from `auth.getUser()` — VERIFIED by the auth server,
 * never from `getSession()`, which only decodes a cookie anyone can forge. It is
 * verified once per access token and remembered, so a server action that runs
 * ten queries does not make ten round trips; signing in or out changes the
 * token, and the next query verifies again.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  );

  let verified: { token: string | null; who: Promise<Who> } | null = null;
  const who = async (): Promise<Who> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!verified || verified.token !== token) {
      verified = {
        token,
        who: token
          ? supabase.auth.getUser().then(({ data: u }) => (u.user ? { uid: u.user.id } : "anon"))
          : Promise.resolve("anon" as const),
      };
    }
    return verified.who;
  };

  const db = dbClient(who);
  return { auth: supabase.auth, storage: supabase.storage, from: db.from, rpc: db.rpc };
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;
