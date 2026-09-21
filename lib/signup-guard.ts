import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/db/admin";
import { signingKey } from "@/lib/secrets";

/**
 * Bot prevention for the email/password signup form.
 *
 * Signup is the one public write that creates an account *and* asks Supabase to
 * send mail, so a script pointed at it costs real money and quota: every attempt
 * burns an outbound confirmation email and, if the address is someone else's,
 * makes us the one delivering the spam. It also fills lp_profiles with accounts
 * that will never buy anything, which quietly poisons every number in the panel.
 *
 * Four layers, cheapest first:
 *
 *  1. Honeypot — a field positioned off-screen. A person can't focus it; naive
 *     form-fillers fill every input they find. Filled means bot.
 *  2. Form token — an HMAC over the moment the page was rendered. It proves the
 *     submission came from a form WE served, and how long the visitor had it
 *     open. Under MIN_FILL_MS nobody typed three fields; that's a replay or a
 *     direct POST.
 *  3. Per-address rate limit — the backstop for a bot that clears both, since a
 *     determined one will. Counts attempts per visitor IP in lp_signup_attempts.
 *  4. Turnstile — an actual proof-of-humanity, verified against Cloudflare.
 *
 * The first three are invisible; the captcha is not, and that is a real cost on
 * this audience — they arrive from Instagram ads in an in-app Android webview,
 * and 81% already bounce inside 8 seconds. Managed mode keeps it to a moment's
 * spinner for most visitors, and the Google button beside the form skips the
 * captcha entirely, so anyone the widget can't serve still has a way in.
 */

/** Shared with the form so the two can't drift apart. Obscure so autofill skips it. */
export const SIGNUP_HONEYPOT_FIELD = "fax";
/** Hidden input carrying the signed render time. */
export const SIGNUP_TOKEN_FIELD = "ts";
/** Turnstile writes its solved token here; the name is fixed by Cloudflare. */
export const CAPTCHA_FIELD = "cf-turnstile-response";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const CAPTCHA_TIMEOUT_MS = 5_000;

/** Below this, the form was not filled in by hand. */
const MIN_FILL_MS = 2_500;
/** A form left open longer than this is stale; a harvested token expires with it. */
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;

/** Attempts allowed from one address per window. */
const MAX_PER_IP = 10;
const WINDOW_MS = 60 * 60 * 1000;

/** HMAC key. Never sent anywhere — only signs a timestamp we issue and verify moments later. */
function formSecret(): string | null {
  return signingKey("signup-form");
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
  // Without a secret (a dev box with no signing key) the token is unsigned and
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
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "";
  if (!raw) return null;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fe80:|fc00:|fd)/i.test(raw)) {
    return null;
  }
  return raw.slice(0, 64);
}

/**
 * Turnstile's site key, or null when the captcha isn't configured. The signup
 * page passes this to the widget; null means don't render one, and the check
 * below skips to match.
 *
 * Read through a function rather than exported as a constant so the value is
 * looked up per request — but note NEXT_PUBLIC_* is inlined at BUILD time, so
 * changing it means rebuilding the image, not restarting the container.
 */
export function captchaSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
}

type CaptchaVerdict = "ok" | "missing" | "expired" | "failed";

/**
 * Cloudflare Turnstile, verified server-side.
 *
 * Not wired through Supabase's own captcha setting on purpose: that switch is
 * project-wide, so turning it on would demand a token from every auth endpoint —
 * login, password recovery, magic links — and break each one until it had a
 * widget too. Verifying here keeps the blast radius on the form we're hardening.
 *
 * Turnstile is the choice over hCaptcha because managed mode clears most
 * visitors with no interaction at all, which matters when two thirds of the
 * traffic is inside Instagram's in-app webview.
 */
async function verifyCaptcha(token: string | null, ip: string | null): Promise<CaptchaVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Unconfigured (no keys yet, or local dev) — the other three layers stand on
  // their own, and a half-configured captcha must not lock the door.
  if (!secret || !captchaSiteKey()) return "ok";
  if (!token) return "missing";

  const body = new URLSearchParams({ secret, response: token });
  // Lets Cloudflare cross-check the solver's address against the submitter's.
  if (ip) body.set("remoteip", ip);

  let data: { success?: boolean; "error-codes"?: string[] };
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      // Signup must not hang on someone else's outage.
      signal: AbortSignal.timeout(CAPTCHA_TIMEOUT_MS),
    });
    if (!res.ok) return "ok";
    data = await res.json();
  } catch {
    // Timeout, DNS, Cloudflare down. Fail OPEN: an outage at the verifier would
    // otherwise close signup entirely, and everything above still applies.
    return "ok";
  }

  if (data.success) return "ok";

  const codes = data["error-codes"] ?? [];
  if (codes.includes("timeout-or-duplicate")) return "expired";
  // invalid-input-secret / missing-input-secret are OUR misconfiguration, not
  // the visitor's — refusing them would blame a person for our broken deploy.
  if (codes.some((c) => c.includes("input-secret"))) return "ok";
  return "failed";
}

/** A form field as a non-empty string, or null. */
function readField(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
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

  const token = verifySignupToken(readField(formData, SIGNUP_TOKEN_FIELD));
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

  if (ip) {
    const admin = createAdminClient();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count, error } = await admin
      .from("lp_signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);

    // A failing counter must not become a locked front door.
    if (!error) {
      if ((count ?? 0) >= MAX_PER_IP) {
        // Indonesian mobile carriers put a lot of subscribers behind one address,
        // so a shared IP genuinely can produce several real signups in an hour.
        // The limit is set well above human behaviour, and the Google button on
        // the same page is not throttled — so even a false positive has a way in.
        return {
          verdict: "reject",
          message:
            "Terlalu banyak percobaan pendaftaran dari jaringan ini. Coba lagi nanti, atau daftar dengan Google.",
        };
      }

      await admin.from("lp_signup_attempts").insert({ ip });

      // Opportunistic cleanup — the table only exists to answer "recently", so
      // anything past the window is dead weight. Roughly one sweep in 20.
      if (Math.random() < 0.05) {
        await admin.from("lp_signup_attempts").delete().lt("created_at", since);
      }
    }
  }

  // Last, because it's the only layer that costs an outbound request — and it
  // runs on attempts the cheap layers already let through.
  switch (await verifyCaptcha(readField(formData, CAPTCHA_FIELD), ip)) {
    case "missing":
      return {
        verdict: "reject",
        message: "Selesaikan verifikasi keamanan dulu, lalu kirim ulang.",
      };
    case "expired":
      // Turnstile tokens are single-use and short-lived; a slow form fill or a
      // resubmitted page lands here, and a fresh widget fixes it.
      return {
        verdict: "reject",
        message: "Verifikasi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.",
      };
    case "failed":
      return {
        verdict: "reject",
        message: "Verifikasi keamanan gagal. Coba lagi, atau daftar dengan Google.",
      };
    default:
      return { verdict: "ok" };
  }
}
