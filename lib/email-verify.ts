import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { signingKey } from "@/lib/secrets";

/**
 * Our own email verification, replacing Supabase's confirmation mail.
 *
 * Supabase's built-in mailer is capped at 2 messages per hour for the entire
 * project, which is not a verification system so much as a lottery — and it sat
 * in front of the first login, so losing that lottery meant losing the customer.
 * Signup no longer waits for it (see the 20260729 migration); this sends the
 * proof-of-address request through Resend, which the project already uses for
 * purchase receipts and has no such cap.
 *
 * The link carries a signed token rather than a row in a table: there is nothing
 * to store that the user id and an expiry don't already say, and a stateless
 * token can't leave orphaned rows behind when someone never clicks. Verification
 * is idempotent, so a token being replayable within its window costs nothing —
 * the worst case is setting an already-set timestamp.
 */

const TTL_MS = 24 * 60 * 60 * 1000;

/** Signing key, never transmitted (lib/secrets.ts). */
function secret(): string | null {
  return signingKey("email-verify");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** `<userId>.<expiry>.<mac>`, URL-safe. Null when no signing key is configured. */
export function issueVerifyToken(userId: string): string | null {
  const key = secret();
  if (!key) return null;
  const body = `${userId}.${(Date.now() + TTL_MS).toString(36)}`;
  return `${body}.${sign(body, key)}`;
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" };

export function readVerifyToken(raw: string | null): VerifyResult {
  const key = secret();
  if (!key || !raw) return { ok: false, reason: "invalid" };

  const parts = raw.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [userId, exp, mac] = parts;

  const expected = Buffer.from(sign(`${userId}.${exp}`, key));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return { ok: false, reason: "invalid" };
  }

  const expiresAt = parseInt(exp, 36);
  if (!Number.isFinite(expiresAt)) return { ok: false, reason: "invalid" };
  // Checked only after the signature, so an expiry can't be read off a forged token.
  if (Date.now() > expiresAt) return { ok: false, reason: "expired" };

  return { ok: true, userId };
}

/**
 * Send the verification link. Best-effort by design: a signup must never fail
 * because an email provider is having a bad minute, and the banner in the panel
 * offers "kirim ulang" for exactly that case.
 */
export async function sendVerificationEmail(opts: {
  to: string;
  userId: string;
  name?: string | null;
  /**
   * Origin for the verify link. Both callers are server actions, so they pass the
   * domain the visitor signed up on — clicking a link back to a different domain
   * would verify them somewhere they never visited, and (since sessions don't
   * cross domains) leave them still unverified where they were.
   */
  origin?: string | null;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const token = issueVerifyToken(opts.userId);
  if (!apiKey || !token) {
    console.warn("email-verify: not configured, skipping send");
    return false;
  }

  const base = (
    opts.origin?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://admuiux.com"
  ).replace(/\/$/, "");
  const link = `${base}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  const greeting = opts.name?.trim() ? `Halo ${opts.name.trim()},` : "Halo,";

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: opts.to,
      subject: "Verifikasi email Anda — ADM.UIUX",
      html: `
        <h1>Verifikasi email</h1>
        <p>${greeting}</p>
        <p>Klik tombol di bawah untuk memastikan alamat email ini benar milik Anda.</p>
        <p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verifikasi sekarang</a></p>
        <p style="color:#666;font-size:12px">Link berlaku 24 jam. Kalau tombol tidak jalan, buka link ini:<br>${link}</p>
        <p style="color:#666;font-size:12px">Kalau Anda tidak membuat akun di ADM.UIUX, abaikan email ini.</p>
        <hr>
        <p style="color:#666;font-size:12px">ADM.UIUX — Landing Page &amp; Digital Assets</p>
      `,
    });
    return true;
  } catch (err) {
    console.error("email-verify send error:", err);
    return false;
  }
}
