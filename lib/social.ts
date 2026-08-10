/**
 * Social network identity — the parts that are NOT server actions.
 *
 * Split out of lib/actions/site-settings.ts because that file is "use server",
 * where every export is compiled into a server action and only async functions
 * are allowed (docs/architecture.md I5). A key list and a defaults object are
 * neither, and the build says so.
 */

export type SocialKey = "threads" | "tiktok" | "instagram" | "youtube";
export type SocialUrls = Record<SocialKey, string>;

export const SOCIAL_KEYS: SocialKey[] = ["threads", "tiktok", "instagram", "youtube"];

/** What the site shipped with, so nothing disappeared the day this became editable. */
export const DEFAULT_SOCIAL_URLS: SocialUrls = {
  threads: "https://www.threads.com/adm.uiux",
  tiktok: "https://tiktok.com/@adm.uiux",
  instagram: "https://instagram.com/adm.uiux",
  youtube: "https://youtube.com/@admuiux",
};

/**
 * Clean a stored value.
 *
 * `undefined` means the key was never set and falls back to the shipped address;
 * an empty string is a DELIBERATE removal and survives as one, which is how a
 * storefront without a TikTok stops showing a TikTok icon. Anything that is not
 * http(s) is treated as removed rather than rendered into an anchor.
 */
export function normalizeSocialUrls(raw: unknown): SocialUrls {
  const v = (raw ?? {}) as Partial<Record<SocialKey, unknown>>;
  const out = {} as SocialUrls;
  for (const key of SOCIAL_KEYS) {
    const url = typeof v[key] === "string" ? (v[key] as string).trim().slice(0, 500) : undefined;
    if (url === undefined) out[key] = DEFAULT_SOCIAL_URLS[key];
    else out[key] = /^https?:\/\//i.test(url) ? url : "";
  }
  return out;
}
