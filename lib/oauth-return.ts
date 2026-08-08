import {
  canonicalOrigin,
  currentHost,
  currentOrigin,
  listSites,
  normalizeHost,
} from "@/lib/site-resolve";

/**
 * Google sign-in for storefronts that are not the canonical domain.
 *
 * Supabase validates the `redirect_to` we hand it against the Redirect URLs list
 * in the dashboard, and a value that isn't listed is not an error — it is
 * silently replaced by the project Site URL. So a visitor who signed in on a
 * niche domain landed on admuiux.com with their session cookie stuck there, and
 * on the domain they started from they still looked signed out. Every new
 * storefront needed a dashboard entry nobody remembers to add.
 *
 * So OAuth now always returns to ONE listed URL — the canonical callback — which
 * bounces the visitor back to the domain they came from. Adding a storefront
 * touches Vercel and lp_sites only; Supabase never has to hear about it.
 *
 * What the canonical callback must NOT do is exchange the code itself. The PKCE
 * verifier that signInWithOAuth generated was written as a cookie on the domain
 * the visitor clicked from, and cookies do not cross hosts — admuiux.com cannot
 * read it, and the exchange would fail with an empty verifier. It forwards the
 * code instead, and the origin domain (which has the verifier) does the exchange
 * and receives the session cookie. That the code is useless anywhere but there is
 * exactly what makes passing it through the detour safe.
 */

/** Carries the storefront through Google and Supabase, which echo unknown params back. */
export const RETURN_HOST_PARAM = "sf";

/**
 * Is this one of our domains? The gate on the forward, and the reason it is not
 * an open redirect: without it, anyone could point the canonical callback at a
 * host they own and be handed a visitor's authorization code.
 *
 * Deliberately ignores `active`. The question is who owns the domain, not whether
 * it is currently serving — and both sides of the handoff have to ask it the same
 * way, or a site switched off mid-login strands the visitor on the wrong host.
 */
export async function resolveReturnHost(raw: string | null): Promise<string | null> {
  const want = normalizeHost(raw);
  if (!want) return null;
  const known = (await listSites()).some((s) => normalizeHost(s.host) === want);
  return known ? want : null;
}

/**
 * Where Supabase should send the visitor after Google. The canonical callback for
 * a known niche storefront, this same origin for anything else.
 *
 * "Anything else" is localhost, a *.vercel.app preview, or a domain pointed at us
 * before it was added in the panel. Those keep the old direct behaviour: the
 * bouncer only forwards to hosts it can verify, so routing them through it would
 * strand them on the canonical domain — the very bug this exists to fix. They
 * still need their own Supabase entry, which for localhost is already there.
 */
export async function googleCallbackUrl(next: string | null): Promise<string> {
  const params = new URLSearchParams();
  if (next) params.set("next", next);

  const here = await resolveReturnHost(await currentHost());
  const canonicalHost = normalizeHost(new URL(canonicalOrigin()).host);

  if (!here || here === canonicalHost) {
    const query = params.toString();
    return `${await currentOrigin()}/auth/callback${query ? `?${query}` : ""}`;
  }

  params.set(RETURN_HOST_PARAM, here);
  return `${canonicalOrigin()}/auth/callback?${params.toString()}`;
}
