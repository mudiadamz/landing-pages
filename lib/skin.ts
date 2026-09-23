/* Visual STYLE — the third theming axis, next to palette and template.
 *
 * The three answer different questions and are deliberately independent:
 *
 *   template  what is on the page      (Marketplace / Pustaka / Link-in-bio / chat)
 *   palette   what colour it is        (lib/palette.ts)
 *   skin      what it is MADE OF       (this file) — corner radius, depth, blur
 *
 * Why it can exist at all: Tailwind v4 compiles `rounded-xl` to
 * `border-radius: var(--radius-xl)` and `backdrop-blur-md` to
 * `blur(var(--blur-md))`, so redefining four variables re-shapes every one of
 * the ~660 rounded-* and 20 backdrop-blur-* usages in the app at once. Shadows
 * are the exception — Tailwind inlines their values into `--tw-shadow` — so
 * those need one class override each. Either way: no component changes, and
 * nothing to keep in sync across 185 files.
 *
 * Tailwind puts its utilities in `@layer utilities`, and an UNLAYERED rule beats
 * any layered one whatever the source order. The <style> this produces is
 * unlayered, so the override is reliable rather than a specificity race.
 *
 * Framework-free (like palette.ts) so the client form and the server layout can
 * both import it.
 */

export type SkinTokens = {
  /** Tailwind's four radius steps, in the order rounded-md/lg/xl/2xl use them. */
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radius2xl: string;
  /** `--blur-*`, feeding every backdrop-blur-* utility. "0" switches glass off. */
  blurSm: string;
  blurMd: string;
  blurXl: string;
  /** `--tw-shadow` for .shadow-sm / .shadow-lg. `0 0 #0000` means no shadow. */
  shadowSm: string;
  shadowLg: string;
};

export type SkinPreset = {
  key: string;
  label: string;
  note: string;
  tokens: SkinTokens;
};

/**
 * Glass reproduces Tailwind's defaults EXACTLY rather than emitting nothing.
 *
 * It has to: the root layout writes the storefront's skin and the panel layout
 * writes its own after it, so "the default emits nothing" would let a Flat
 * storefront leak its square corners into a Glass panel. Emitting explicit
 * values for every skin makes the later rule always win, which is the whole
 * reason the two scopes can be set independently.
 *
 * Values lifted from the compiled stylesheet, not guessed.
 */
const GLASS: SkinTokens = {
  radiusMd: "0.375rem",
  radiusLg: "0.5rem",
  radiusXl: "0.75rem",
  radius2xl: "1rem",
  blurSm: "8px",
  blurMd: "12px",
  blurXl: "24px",
  shadowSm:
    "0 1px 3px 0 var(--tw-shadow-color,#0000001a),0 1px 2px -1px var(--tw-shadow-color,#0000001a)",
  shadowLg:
    "0 10px 15px -3px var(--tw-shadow-color,#0000001a),0 4px 6px -4px var(--tw-shadow-color,#0000001a)",
};

export const SKIN_PRESETS: SkinPreset[] = [
  {
    key: "glass",
    label: "Glass (bawaan)",
    note: "Sudut lembut, bayangan halus, latar buram — tampilan situs saat ini.",
    tokens: GLASS,
  },
  {
    key: "flat",
    label: "Flat",
    note: "Tanpa bayangan & tanpa blur. Garis 1px yang membentuk struktur, sudut lebih rapat.",
    tokens: {
      // Not zero: square corners are Brutalist, and this is meant to read as
      // plain rather than loud. Each step drops about a third.
      radiusMd: "0.25rem",
      radiusLg: "0.375rem",
      radiusXl: "0.5rem",
      radius2xl: "0.625rem",
      // Blur off. The frosted bars become solid, which is the single biggest
      // part of losing the "Apple glass" read.
      blurSm: "0",
      blurMd: "0",
      blurXl: "0",
      // No depth at all. With shadows gone the existing 1px borders are what
      // separate a card from the page — they were always there, just outvoted.
      shadowSm: "0 0 #0000",
      shadowLg: "0 0 #0000",
    },
  },
];

export const DEFAULT_SKIN = "glass";

/** A key we recognise, or the default. Never trust a stored string. */
export function normalizeSkin(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase();
  return SKIN_PRESETS.some((p) => p.key === s) ? s : DEFAULT_SKIN;
}

export function skinFromKey(value: unknown): SkinPreset {
  const key = normalizeSkin(value);
  return SKIN_PRESETS.find((p) => p.key === key) ?? SKIN_PRESETS[0];
}

/**
 * The <style> body for a skin. Always emits every token — see the note on GLASS.
 *
 * `:root` for the variables (they cascade to everything) and bare class
 * selectors for the two shadows, because Tailwind inlines those rather than
 * pointing them at a variable we could redefine.
 */
export function skinCss(value: unknown): string {
  const t = skinFromKey(value).tokens;
  return (
    `:root{--radius-md:${t.radiusMd};--radius-lg:${t.radiusLg};` +
    `--radius-xl:${t.radiusXl};--radius-2xl:${t.radius2xl};` +
    `--blur-sm:${t.blurSm};--blur-md:${t.blurMd};--blur-xl:${t.blurXl}}` +
    `.shadow-sm{--tw-shadow:${t.shadowSm}}` +
    `.shadow-lg{--tw-shadow:${t.shadowLg}}` +
    // The bare `backdrop-blur` utility hardcodes 8px instead of reading a
    // variable, so it needs saying separately or the frosted bars survive.
    `.backdrop-blur{--tw-backdrop-blur:blur(${t.blurSm})}`
  );
}
