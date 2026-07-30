/* Promo popup shown over the product preview. Types + defaults live here (not in
 * the "use server" action file) so client components can import them.
 *
 * Stored as JSON in lp_site_settings.value under the key "promo_popup".
 *
 * The whole design constraint is that this must not cost the preview anything.
 * The preview is the page the business is judged on, and it was tuned hard: a
 * blank reader while a 3.42 MB EPUB parsed once ate an entire ad budget. So the
 * config carries only strings — no image is referenced in the initial HTML, and
 * nothing is fetched until the popup is about to appear, long after load.
 */

export type PromoPopup = {
  enabled: boolean;
  /** Public URL of the WebP. Empty disables the popup regardless of `enabled`. */
  imageUrl: string;
  /** Where the image links to. Empty renders the image without a link. */
  href: string;
  /** Alt text — the image carries the whole message, so it must have one. */
  alt: string;
  /** Intrinsic size, used to reserve space so the popup cannot shift layout. */
  width: number;
  height: number;
  /**
   * Delay after the page finishes loading, in milliseconds.
   *
   * Default 8000, derived from this site's own preview telemetry rather than
   * convention: at 8s a popup still reaches 100% of "curious" and "read"
   * visitors while firing for only 21% of bouncers. Later loses engaged
   * visitors fast (74% of curious at 15s, 58% at 20s); earlier only adds
   * impressions for people already leaving.
   */
  delayMs: number;
  /** Also open on exit intent (pointer leaving the viewport), before the delay. */
  exitIntent: boolean;

  /* ---- copy ---- */
  eyebrow: string;
  title: string;
  body: string;
  /** Submit button on the email form. */
  ctaLabel: string;
  /** Ask for an email. Off makes the popup purely an announcement. */
  emailCapture: boolean;
  instagramUrl: string;
  instagramLabel: string;
  dismissLabel: string;
  doneTitle: string;
  doneBody: string;
};

export const PROMO_KEY = "promo_popup";

export const DEFAULT_PROMO: PromoPopup = {
  enabled: false,
  imageUrl: "",
  href: "",
  alt: "",
  width: 0,
  height: 0,
  delayMs: 8000,
  exitIntent: true,

  eyebrow: "dari penulisnya",
  title: "suka sama ceritanya?",
  body: "aku nulis cerita kayak gini pelan-pelan, sepenuh hati. kalau kamu mau aku kabari tiap ada bab atau buku baru, tinggalin email kamu aja ya.",
  ctaLabel: "kabari aku ya",
  emailCapture: true,
  instagramUrl: "https://instagram.com/admuiux",
  instagramLabel: "atau ikutin ceritanya di instagram",
  dismissLabel: "nanti aja",
  doneTitle: "makasih ya 🌧️",
  doneBody: "nanti aku kabari kalau ada cerita baru.",
};

/** Trimmed, capped, and falling back to the default when blanked. */
const str = (v: unknown, fallback: string, max: number) => {
  const t = String(v ?? "").trim();
  return (t || fallback).slice(0, max);
};

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizePromo(raw: unknown): PromoPopup {
  if (!raw || typeof raw !== "object") return DEFAULT_PROMO;
  const v = raw as Partial<PromoPopup>;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_PROMO.enabled,
    imageUrl: String(v.imageUrl ?? "").trim(),
    href: String(v.href ?? "").trim(),
    alt: String(v.alt ?? "").trim().slice(0, 200),
    width: clampInt(v.width, 0, 4000, 0),
    height: clampInt(v.height, 0, 4000, 0),
    // Floor of 1s: anything faster fires while the preview is still settling,
    // which is the failure mode this feature must not reintroduce.
    delayMs: clampInt(v.delayMs, 1000, 120000, DEFAULT_PROMO.delayMs),
    exitIntent: typeof v.exitIntent === "boolean" ? v.exitIntent : DEFAULT_PROMO.exitIntent,
    eyebrow: str(v.eyebrow, DEFAULT_PROMO.eyebrow, 60),
    title: str(v.title, DEFAULT_PROMO.title, 120),
    body: str(v.body, DEFAULT_PROMO.body, 600),
    ctaLabel: str(v.ctaLabel, DEFAULT_PROMO.ctaLabel, 40),
    emailCapture:
      typeof v.emailCapture === "boolean" ? v.emailCapture : DEFAULT_PROMO.emailCapture,
    instagramUrl: String(v.instagramUrl ?? "").trim(),
    instagramLabel: str(v.instagramLabel, DEFAULT_PROMO.instagramLabel, 80),
    dismissLabel: str(v.dismissLabel, DEFAULT_PROMO.dismissLabel, 40),
    doneTitle: str(v.doneTitle, DEFAULT_PROMO.doneTitle, 80),
    doneBody: str(v.doneBody, DEFAULT_PROMO.doneBody, 200),
  };
}

/** Everything needed to render, or null when it should not render at all. */
export function activePromo(p: PromoPopup): PromoPopup | null {
  // No image requirement any more: the popup draws its own scene, and an
  // uploaded WebP only replaces that header. Copy is what it needs.
  return p.enabled && p.title ? p : null;
}
