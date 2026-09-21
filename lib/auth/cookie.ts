/**
 * The session cookie's names, on their own so proxy.ts can read them without
 * pulling in next/headers. On HTTPS the cookie is `__Host-lp_session`: the
 * prefix makes the browser refuse it unless it is Secure, host-only and
 * path=/ — so no subdomain and no plain-HTTP response can plant or overwrite
 * one. Local HTTP gets the plain name, because a Secure cookie would never be
 * sent back there.
 */
export const SESSION_COOKIE = "lp_session";
export const SECURE_SESSION_COOKIE = "__Host-lp_session";

export function sessionTokenFrom(get: (name: string) => string | undefined): string | null {
  return get(SECURE_SESSION_COOKIE) ?? get(SESSION_COOKIE) ?? null;
}
