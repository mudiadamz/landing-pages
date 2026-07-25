/**
 * Tracking / marketing tag configuration. Currently the Google Tag Manager
 * container id; shaped as an object so GA/Pixel ids can move here later. Stored
 * as JSON in lp_site_settings (key "tracking"), editable at /panel/tracking,
 * with an env fallback (NEXT_PUBLIC_GTM_ID) so it can also be set in Vercel.
 */

export type TrackingConfig = {
  gtmId: string; // "GTM-XXXXXXX" or "" when disabled
};

export const DEFAULT_TRACKING: TrackingConfig = { gtmId: "" };

/** GTM container ids look like GTM-XXXXXXX (letters/digits after the prefix). */
export function normalizeGtmId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let v = raw.trim().toUpperCase();
  if (!v) return "";
  if (!v.startsWith("GTM-")) v = `GTM-${v.replace(/^GTM-?/, "")}`;
  return /^GTM-[A-Z0-9]{4,20}$/.test(v) ? v : "";
}

export function normalizeTracking(raw: unknown): TrackingConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return { gtmId: normalizeGtmId(obj.gtmId) };
}
