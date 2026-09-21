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
 * Google only redirects to callback URLs registered in its console, compared
 * exactly. Registering every storefront there is a step nobody remembers when
 * a domain is added, so sign-in always returns to ONE registered URL — the
 * canonical callback — which bounces the visitor back to the domain they came
 * from. Adding a storefront touches DNS and lp_sites only.
 *
 * What the canonical callback must NOT do is exchange the code itself. The PKCE
 * verifier was written as a cookie on the domain the visitor clicked from, and
 * cookies do not cross hosts — the canonical domain cannot read it. It forwards
 * the code instead, and the origin domain (which has the verifier) does the
 * exchange and receives the session cookie. That the code is useless anywhere
 * but there is exactly what makes passing it through the detour safe.
 *
 * The storefront travels inside OAuth `state` (lib/backend/google.ts), since
 * redirect_uri cannot vary.
 */

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
 * Where Google should send the visitor, and which storefront the canonical
 * callback should forward to. The canonical callback for a known niche
 * storefront; this same origin for anything else.
 *
 * "Anything else" is localhost, a staging hostname, or a domain pointed at us
 * before it was added in the panel. Those keep the direct behaviour: the
 * bouncer only forwards to hosts it can verify, so routing them through it would
 * strand them on the canonical domain — the very bug this exists to fix. Their
 * own callback URL has to be registered with Google, which for localhost is.
 */
export async function googleRedirect(): Promise<{ redirectUri: string; returnHost: string | null }> {
  const here = await resolveReturnHost(await currentHost());
  const canonicalHost = normalizeHost(new URL(canonicalOrigin()).host);
  if (!here || here === canonicalHost) {
    return { redirectUri: `${await currentOrigin()}/auth/callback`, returnHost: null };
  }
  return { redirectUri: `${canonicalOrigin()}/auth/callback`, returnHost: here };
}
