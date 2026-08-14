import { DEFAULT_LOCALE, type Locale } from "./index";

/**
 * The languages a storefront can be set to, for the picker in /panel/branding.
 *
 * `native` is the language's own name, not its Indonesian or English name: a
 * list that reads "Indonesia / Inggris" is only useful to someone who already
 * reads Indonesian, which is the wrong assumption for the control that chooses
 * whether they have to.
 */
export type LocaleOption = { key: Locale; native: string; note: string };

export const LOCALE_OPTIONS: LocaleOption[] = [
  { key: "id", native: "Bahasa Indonesia", note: "Bawaan · default" },
  { key: "en", native: "English", note: "Storefront copy, buttons, and the reader" },
];

export const FALLBACK_LOCALE_OPTION: LocaleOption =
  LOCALE_OPTIONS.find((o) => o.key === DEFAULT_LOCALE) ?? LOCALE_OPTIONS[0];
