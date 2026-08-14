import { en } from "./en";
import { id, type MessageKey } from "./id";

/**
 * The one way a component gets a piece of user-facing text.
 *
 * No provider, no context, no async: there is a single locale today, so `t` is
 * a plain function that works identically in a Server Component, a Client
 * Component and a Server Action. That matters more than it sounds — the strings
 * being moved live in all three, and a hook would have excluded two of them.
 *
 * There are two dictionaries now, `id` and `en`, and nothing that calls `t` had
 * to change to add the second — which was the reason for doing the extraction
 * before a translation was actually needed.
 *
 * `locale` is still an explicit third argument rather than ambient state. A
 * module-level "current locale" would be wrong here in a way that is easy to
 * miss: this is one server handling several tenants at once, so a mutable
 * global would leak one visitor's language into another's response. Callers
 * that need a non-default locale pass it; see `localeForSite`.
 */

const DICTIONARIES = { id, en } as const;

export type Locale = keyof typeof DICTIONARIES;

export const DEFAULT_LOCALE: Locale = "id";

/**
 * Look up a message, with optional `{name}` substitution.
 *
 * A missing key returns the key itself rather than an empty string: an
 * untranslated label reading "home.searchLabel" on screen is a bug anyone can
 * see and fix, while a blank one looks like a layout problem and survives.
 */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const raw: string = dict[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * A `t` bound to one locale.
 *
 * Components take the storefront's locale as a prop and open with
 * `const t = translator(locale)`, after which every call in the body reads
 * exactly as it did when there was one language. That is the point: threading a
 * locale through should not mean touching sixty call sites and getting the
 * third argument right at each one.
 */
export function translator(locale: Locale = DEFAULT_LOCALE) {
  return (key: MessageKey, vars?: Record<string, string | number>): string =>
    t(key, vars, locale);
}

/**
 * Coerce whatever the database holds into a Locale.
 *
 * The `lp_sites.locale` CHECK constraint already limits the column to values we
 * ship, but the row arrives here as an unchecked cast, and a deployment running
 * against a database where the migration has not been applied yet gets
 * `undefined`. Narrowing at that boundary keeps the Site type honest instead of
 * leaving `t` to paper over it on every single call.
 */
export function normalizeLocale(raw: unknown): Locale {
  return typeof raw === "string" && raw in DICTIONARIES ? (raw as Locale) : DEFAULT_LOCALE;
}

export type { MessageKey };
