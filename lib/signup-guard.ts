import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Bot prevention for the email/password signup form.
 *
 * Signup is the one public write that creates an account *and* asks Supabase to
 * send mail, so a script pointed at it costs real money and quota: every attempt
 * burns an outbound confirmation email and, if the address is someone else's,
 * makes us the one delivering the spam. It also fills lp_profiles with accounts
 * that will never buy anything, which quietly poisons every number in the panel.
 *
 * Three layers, cheapest first, none of which a real visitor ever sees:
 *
 *  1. Honeypot — a field positioned off-screen. A person can't focus it; naive
 *     form-fillers fill every input they find. Filled means bot.
 *  2. Form token — an HMAC over the moment the page was rendered. It proves the
 *     submission came from a form WE served, and how long the visitor had it
 *     open. Under MIN_FILL_MS nobody typed three fields; that's a replay or a
 *     direct POST.
 *  3. Per-address rate limit — the backstop for a bot that clears both, since a
 *     determined one will. Counts attempts per visitor IP in lp_signup_attempts.
 *
 * Deliberately no captcha: the audience arrives from Instagram ads in an in-app
 * Android webview, where a challenge iframe is exactly the kind of friction that
 * loses the 81% who already bounce inside 8 seconds. These three cost the
 * visitor nothing.
 */

/** Shared with the form so the two can't drift apart. Obscure so autofill skips it. */
export const SIGNUP_HONEYPOT_FIELD = "fax";
/** Hidden input carrying the signed render time. */
export const SIGNUP_TOKEN_FIELD = "ts";

/** Below this, the form was not filled in by hand. */
const MIN_FILL_MS = 2_500;
/** A form left open longer than this is stale; a harvested token expires with it. */
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;

/** Attempts allowed from one address per window. */
const MAX_PER_IP = 10;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * HMAC key. Never sent anywhere — only used to sign a timestamp we issue and
 * verify moments later — so the service role key is a fine source of entropy,
 * and it's guaranteed to be present wherever signup runs. SIGNUP_FORM_SECRET
 * overrides it if you'd rather keep the two apart.
 */
function formSecret(): string | null {
  return process.env.SIGNUP_FORM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Stamp the form at render time. Call from the signup page and render the result
 * into a hidden SIGNUP_TOKEN_FIELD input.
 */
export function issueSignupToken(): string {
  const secret = formSecret();
  const issued = Date.now().toString(36);
  // Without a secret (a dev box with no service key) the token is unsigned and
  // verification skips the timing check rather than blocking signup entirely.
  return secret ? `${issued}.${sign(issued, secret)}` : issued;
}

type TokenVerdict = "ok" | "too_fast" | "stale" | "invalid";

function verifySignupToken(raw: string | null): TokenVerdict {
  const secret = formSecret();
  if (!secret) return "ok";
  if (!raw) return "invalid";

  const [issued, mac] = raw.split(".");
  if (!issued || !mac) return "invalid";

  const expected = Buffer.from(sign(issued, secret));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return "invalid";

  const at = parseInt(issued, 36);
  if (!Number.isFinite(at)) return "invalid";

  const age = Date.now() - at;
  // Negative age means a clock skew or a forged-but-somehow-signed future stamp.
  if (age < 0 || age > MAX_FORM_AGE_MS) return "stale";
  if (age < MIN_FILL_MS) return "too_fast";
  return "ok";
}

/**
 * The visitor's address as the edge saw it. Null on a loopback/LAN address,
 * which means local dev or a proxy that isn't forwarding — nothing worth keying
 * a limit on, so the limit is skipped rather than applied to everyone at once.
 */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "";
  if (!raw) return null;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fe80:|fc00:|fd)/i.test(raw)) {
    return null;
  }
  return raw.slice(0, 64);
}

export type SignupVerdict =
  /** Let it through. */
  | { verdict: "ok" }
  /** Caught, but answer as if it worked — never tell a bot which layer stopped it. */
  | { verdict: "silent" }
  /** Caught, and a person could plausibly be on the other end: explain it. */
  | { verdict: "reject"; message: string };

/**
 * Run every layer. Call once at the top of the signup action, before touching
 * Supabase auth.
 */
export async function guardSignup(formData: FormData): Promise<SignupVerdict> {
  const honeypot = formData.get(SIGNUP_HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { verdict: "silent" };
  }

  const token = verifySignupToken(
    typeof formData.get(SIGNUP_TOKEN_FIELD) === "string"
      ? (formData.get(SIGNUP_TOKEN_FIELD) as string)
      : null,
  );
  if (token === "invalid") {
    // No valid token means this didn't come from our form. Nothing useful to say
    // to a script, and a person who somehow lands here is fixed by a reload.
    return { verdict: "silent" };
  }
  if (token === "stale") {
    return {
      verdict: "reject",
      message: "Formulir sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.",
    };
  }
  if (token === "too_fast") {
    // A human retrying now takes longer than MIN_FILL_MS by definition, so this
    // message is self-clearing.
    return { verdict: "reject", message: "Terlalu cepat. Coba kirim sekali lagi." };
  }

  const ip = await clientIp();
  if (!ip) return { verdict: "ok" };

  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("lp_signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);

  // A failing counter must not become a locked front door.
  if (error) return { verdict: "ok" };

  if ((count ?? 0) >= MAX_PER_IP) {
    // Indonesian mobile carriers put a lot of subscribers behind one address, so
    // a shared IP genuinely can produce several real signups in an hour. The
    // limit is set well above human behaviour, and the Google button on the same
    // page is not throttled — so even a false positive still has a way in.
    return {
      verdict: "reject",
      message:
        "Terlalu banyak percobaan pendaftaran dari jaringan ini. Coba lagi nanti, atau daftar dengan Google.",
    };
  }

  await admin.from("lp_signup_attempts").insert({ ip });

  // Opportunistic cleanup — the table only exists to answer "recently", so
  // anything past the window is dead weight. Roughly one sweep every 20 signups.
  if (Math.random() < 0.05) {
    await admin.from("lp_signup_attempts").delete().lt("created_at", since);
  }

  return { verdict: "ok" };
}
