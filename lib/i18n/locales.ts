import { DEFAULT_LOCALE, type Locale } from "./index";

/**
 * The languages a storefront can be set to, for the picker in /panel/branding.
 *
 * `native` is the language's own name, not its Indonesian or English name: a
 * list that reads "Indonesia / Inggris" is only useful to someone who already
 * reads Indonesian, which is the wrong assumption for the control that chooses
 * whether they have to.
 */
export type LocaleOption = {
  key: Locale;
  native: string;
  note: string;
  /** Regional-indicator pair. Rendered as text, so it needs no asset and no fallback image. */
  flag: string;
  /** ISO 639-2/T. Three letters read as a language everywhere; two ("id") reads as a word in English. */
  code: string;
};

export const LOCALE_OPTIONS: LocaleOption[] = [
  {
    key: "id",
    native: "Bahasa Indonesia",
    note: "Bawaan · default",
    flag: "🇮🇩",
    code: "IND",
  },
  {
    key: "en",
    native: "English",
    note: "Storefront copy, buttons, and the reader",
    // The Union Jack, not the Stars and Stripes: this storefront's English is
    // written in British spelling, and a flag is a claim about which one.
    flag: "🇬🇧",
    code: "ENG",
  },
];

export const FALLBACK_LOCALE_OPTION: LocaleOption =
  LOCALE_OPTIONS.find((o) => o.key === DEFAULT_LOCALE) ?? LOCALE_OPTIONS[0];

/**
 * Where a visitor's own choice lives.
 *
 * Named here rather than in `request.ts` because the switcher writes this
 * cookie from the browser and cannot import that module — it pulls in
 * `next/headers`. One name in one client-safe file beats two literals that
 * agree until somebody renames one.
 */
export const LOCALE_COOKIE = "lp_locale";

/** A year. A language preference is not a session; re-picking it every visit is the bug. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The whole locale decision, as a pure function.
 *
 * `siteLocale` is the storefront's setting and the answer for a first-time
 * visitor. A cookie only wins when it names a locale we actually ship —
 * otherwise a junk or stale value would quietly drag an English storefront back
 * to the default, which is worse than ignoring it.
 */
export function pickLocale(cookieValue: string | undefined | null, siteLocale: Locale): Locale {
  return cookieValue && LOCALE_OPTIONS.some((o) => o.key === cookieValue)
    ? (cookieValue as Locale)
    : siteLocale;
}
