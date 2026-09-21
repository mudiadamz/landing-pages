import { cookies, headers } from "next/headers";
import { cache } from "react";
import { createSession, revokeSession, validateSession, type AuthUser } from "@/lib/backend/auth";
import { clientIp } from "@/lib/signup-guard";
import type { OAuthPending } from "@/lib/backend/google";
import { SECURE_SESSION_COOKIE, SESSION_COOKIE, sessionTokenFrom } from "./cookie";

/**
 * The session cookie, for server components, actions and route handlers.
 * (proxy.ts reads the same names from the request directly — ./cookie.ts.)
 *
 * The cookie is kept long (400 days, the browser cap) on purpose: whether a
 * session is alive is decided by its row in app_auth.sessions, which slides
 * 30 days from last use. A cookie outliving its row is just an unknown token.
 */

const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

async function isHttps(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return process.env.NODE_ENV === "production" && !(process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("http:");
}

/** The signed-in user for this request, validated once per render. */
export const currentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  return validateSession(sessionTokenFrom((n) => store.get(n)?.value));
});

/** Start a session and hand the browser its cookie. Server actions and route handlers only. */
export async function startSession(userId: string): Promise<void> {
  const h = await headers();
  const token = await createSession(userId, { ip: await clientIp(), userAgent: h.get("user-agent") });
  const store = await cookies();
  const secure = await isHttps();
  store.set(secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  dropLegacyCookies(store);
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  await revokeSession(sessionTokenFrom((n) => store.get(n)?.value));
  // A __Host- cookie can only be overwritten by one that is itself Secure +
  // path=/ — a bare delete() would be refused and the browser would keep it.
  store.set(SECURE_SESSION_COOKIE, "", { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  store.delete(SESSION_COOKIE);
  dropLegacyCookies(store);
}

/** GoTrue's `sb-<ref>-auth-token(.N)` cookies: inert now, but still sent with every request. */
function dropLegacyCookies(store: Awaited<ReturnType<typeof cookies>>) {
  for (const c of store.getAll()) if (/^sb-.*-auth-token/.test(c.name)) store.delete(c.name);
}

// ---------------------------------------------------------------------------
// Google sign-in in flight
// ---------------------------------------------------------------------------

/**
 * The PKCE verifier and state of a Google sign-in, between leaving for Google
 * and coming back. Ten minutes, httpOnly, on the domain the visitor started
 * from — only that domain can finish the exchange (lib/oauth-return.ts).
 * SameSite=Lax still sends it on the top-level redirect back from Google.
 */
const OAUTH_COOKIE = "lp_oauth";

export async function setOAuthPending(pending: OAuthPending): Promise<void> {
  (await cookies()).set(OAUTH_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: await isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

/** Read once: the cookie is removed whatever happens next, so a code can't be replayed against it. */
export async function takeOAuthPending(): Promise<OAuthPending | null> {
  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  store.delete(OAUTH_COOKIE);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as OAuthPending;
    return typeof p.state === "string" && typeof p.verifier === "string" && typeof p.redirectUri === "string" ? p : null;
  } catch {
    return null;
  }
}
