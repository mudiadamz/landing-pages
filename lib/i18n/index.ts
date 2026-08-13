import { id, type MessageKey } from "./id";

/**
 * The one way a component gets a piece of user-facing text.
 *
 * No provider, no context, no async: there is a single locale today, so `t` is
 * a plain function that works identically in a Server Component, a Client
 * Component and a Server Action. That matters more than it sounds — the strings
 * being moved live in all three, and a hook would have excluded two of them.
 *
 * Adding a locale later means a second dictionary and a lookup by locale here.
 * Nothing that calls `t` has to change, which is the reason for doing this now
 * rather than when a translation is actually needed.
 */

const DICTIONARIES = { id } as const;

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

export type { MessageKey };
