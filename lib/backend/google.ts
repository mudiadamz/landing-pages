import { createHash, randomBytes } from "node:crypto";
import { AuthError, type GoogleClaims } from "./auth";

/**
 * Google sign-in: OAuth 2 authorization code + PKCE, spoken directly — no SDK.
 * (arctic, the library the plan named, was deprecated upstream.)
 *
 * The id_token is read without checking its signature. That is allowed exactly
 * here (OpenID Connect Core §3.1.3.7): it came straight from Google's token
 * endpoint over TLS in exchange for a code only we could redeem — the secret
 * and the PKCE verifier both had to match. Issuer, audience and expiry are
 * still checked.
 */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

const b64url = (b: Buffer) => b.toString("base64url");

/**
 * Everything one sign-in attempt needs to remember between leaving for Google
 * and coming back. Stored in a short-lived httpOnly cookie on the domain the
 * visitor started from — that domain, and only that one, finishes the exchange.
 */
export type OAuthPending = { state: string; verifier: string; redirectUri: string; next: string | null };

/**
 * `returnHost` rides inside `state` because Google compares redirect_uri
 * exactly and so cannot carry it: the canonical callback reads it back out to
 * know where to forward the code (lib/oauth-return.ts). The random part is what
 * the origin domain checks against its cookie.
 */
export function startGoogle(opts: { redirectUri: string; returnHost: string | null; next: string | null }) {
  const cfg = googleConfig();
  if (!cfg) throw new AuthError("oauth_failed");
  const random = b64url(randomBytes(24));
  const state = opts.returnHost ? `${random}.${opts.returnHost}` : random;
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: opts.redirectUri,
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  const pending: OAuthPending = { state, verifier, redirectUri: opts.redirectUri, next: opts.next };
  return { url: url.toString(), pending };
}

/** The host a `state` asks to be returned to, if any. Still to be validated against lp_sites. */
export function returnHostFromState(state: string | null): string | null {
  if (!state) return null;
  const dot = state.indexOf(".");
  return dot === -1 ? null : state.slice(dot + 1) || null;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1];
  if (!part) throw new AuthError("oauth_failed");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

export async function exchangeGoogleCode(code: string, pending: OAuthPending): Promise<GoogleClaims> {
  const cfg = googleConfig();
  if (!cfg) throw new AuthError("oauth_failed");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: pending.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code_verifier: pending.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new AuthError("oauth_failed");
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new AuthError("oauth_failed");

  const c = decodeJwtPayload(body.id_token);
  const exp = typeof c.exp === "number" ? c.exp : 0;
  if (!ISSUERS.has(String(c.iss)) || c.aud !== cfg.clientId || exp * 1000 < Date.now() || typeof c.sub !== "string") {
    throw new AuthError("oauth_failed");
  }
  return {
    sub: c.sub,
    email: typeof c.email === "string" ? c.email : undefined,
    email_verified: c.email_verified === true || c.email_verified === "true",
    name: typeof c.name === "string" ? c.name : undefined,
    picture: typeof c.picture === "string" ? c.picture : undefined,
  };
}
