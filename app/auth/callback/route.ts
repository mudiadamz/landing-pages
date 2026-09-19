import { createClient } from "@/lib/supabase/server";
import { ensureSiteMembership } from "@/lib/actions/profiles";
import { currentSiteId } from "@/lib/site-resolve";
import { NextResponse } from "next/server";
import { currentOrigin, normalizeHost } from "@/lib/site-resolve";
import { RETURN_HOST_PARAM, resolveReturnHost } from "@/lib/oauth-return";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/panel";
  // Not `new URL(request.url).origin`: behind Caddy that is the container's own
  // address, and this value decides which domain the visitor ends up on.
  // x-forwarded-host is the one the browser actually asked for.
  const origin = await currentOrigin();

  /**
   * The handoff. Supabase only knows one callback URL — the canonical one — so a
   * sign-in that started on a niche storefront arrives here carrying the domain
   * it came from, and gets sent back to finish there.
   *
   * The exchange has to happen there, not here: signInWithOAuth wrote the PKCE
   * verifier as a cookie on that domain, and this one cannot read it. See
   * lib/oauth-return.ts.
   */
  const returnTo = await resolveReturnHost(searchParams.get(RETURN_HOST_PARAM));
  if (returnTo && returnTo !== normalizeHost(new URL(origin).host)) {
    const forward = new URL("/auth/callback", `https://${returnTo}`);
    // Everything Supabase sent, including `error`/`error_description` when there
    // is no code — a failed login belongs on the visitor's own domain too. The
    // handoff param is dropped so the destination can't bounce it onward again.
    searchParams.forEach((value, key) => {
      if (key !== RETURN_HOST_PARAM) forward.searchParams.set(key, value);
    });
    return NextResponse.redirect(forward);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Login Google pertama kali juga membuat akun, jadi keanggotaannya dicatat
      // di sini — signup lewat form punya jalurnya sendiri di lib/actions/auth.
      // Idempoten, jadi login kedua dan seterusnya tidak melakukan apa-apa.
      if (data?.user) await ensureSiteMembership(data.user.id, await currentSiteId());
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Gagal masuk dengan Google")}`);
}
