import { createHmac } from "node:crypto";

/**
 * Signing key for the small HMAC tokens (signup form stamp, email-verify link).
 *
 * SIGNUP_FORM_SECRET when set. Otherwise one derived from STORAGE_SIGNING_SECRET
 * — which production cannot run without (every download URL is signed with
 * it) — and derived PER PURPOSE, so a token minted for one use is never a valid
 * signature for another. Until fase 6 of docs/plans/remove-supabase.md this
 * fell back to the Supabase service role key, which no longer exists.
 *
 * Null only on a dev box with neither set; callers degrade (no timing check, no
 * verification mail) rather than block signup.
 */
export function signingKey(purpose: "signup-form" | "email-verify"): string | null {
  if (process.env.SIGNUP_FORM_SECRET) return process.env.SIGNUP_FORM_SECRET;
  const root = process.env.STORAGE_SIGNING_SECRET;
  return root ? createHmac("sha256", root).update(`lp:${purpose}`).digest("base64url") : null;
}
