import { cookies } from "next/headers";
import { currentSite } from "@/lib/site-resolve";
import { LOCALE_COOKIE, pickLocale } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n";

/**
 * Which language THIS request renders in: the visitor's footer choice if they
 * made one, otherwise the storefront's setting.
 *
 * Site.locale deliberately stays the STORED value. A request-scoped preference
 * written onto the row would make `currentSite()` disagree with the row the
 * panel edits — an admin who switched language in the footer would see their
 * own override presented as the saved setting, and save it.
 *
 * Reading cookies makes a route dynamic. Nothing here is prerendered (every
 * route in this app already renders on demand), and the unstable_cache entries
 * hold DATA rather than translated strings, so the locale never has to become
 * part of a cache key.
 */
export async function requestLocale(): Promise<Locale> {
  const [jar, site] = await Promise.all([cookies(), currentSite()]);
  return pickLocale(jar.get(LOCALE_COOKIE)?.value, site.locale);
}
