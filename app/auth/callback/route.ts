import { ensureSiteMembership } from "@/lib/actions/profiles";
import { currentSiteId } from "@/lib/site-resolve";
import { NextResponse } from "next/server";
import { currentOrigin, normalizeHost } from "@/lib/site-resolve";
import { resolveReturnHost } from "@/lib/oauth-return";
import { AuthError, signInWithGoogleClaims } from "@/lib/backend/auth";
import { exchangeGoogleCode, returnHostFromState } from "@/lib/backend/google";
import { startSession, takeOAuthPending } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/next-path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  // Not `new URL(request.url).origin`: behind Caddy that is the container's own
  // address, and this value decides which domain the visitor ends up on.
  // x-forwarded-host is the one the browser actually asked for.
  const origin = await currentOrigin();
  const fail = (message = "Gagal masuk dengan Google") =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  /**
   * The handoff. Google only knows one callback URL — the canonical one — so a
   * sign-in that started on a niche storefront arrives here with that domain
   * inside `state`, and gets sent back to finish there.
   *
   * The exchange has to happen there, not here: the PKCE verifier is a cookie
   * on that domain, and this one cannot read it. See lib/oauth-return.ts.
   */
  const returnTo = await resolveReturnHost(returnHostFromState(state));
  if (returnTo && returnTo !== normalizeHost(new URL(origin).host)) {
    const forward = new URL("/auth/callback", `https://${returnTo}`);
    // Everything Google sent, including `error` when there is no code — a
    // failed login belongs on the visitor's own domain too.
    searchParams.forEach((value, key) => forward.searchParams.set(key, value));
    return NextResponse.redirect(forward);
  }

  // Taken (and cleared) before anything else can fail, so a code is tried
  // against a given verifier at most once.
  const pending = await takeOAuthPending();
  // The state has to be the one THIS browser started with. Without the check,
  // an attacker could hand a victim a link carrying the attacker's own code
  // and sign them in as the attacker (login CSRF).
  if (!code || !pending || !state || pending.state !== state) return fail();

  try {
    const user = await signInWithGoogleClaims(await exchangeGoogleCode(code, pending));
    // Login Google pertama kali juga membuat akun, jadi keanggotaannya dicatat
    // di sini — signup lewat form punya jalurnya sendiri di lib/actions/auth.
    // Idempoten, jadi login kedua dan seterusnya tidak melakukan apa-apa.
    await ensureSiteMembership(user.id, await currentSiteId());
    await startSession(user.id);
    return NextResponse.redirect(`${origin}${safeNextPath(pending.next) ?? "/panel"}`);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message);
    console.error("Google callback error:", e);
    return fail();
  }
}
