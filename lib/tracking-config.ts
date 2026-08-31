/**
 * Tracking / marketing tag configuration: the Google Tag Manager container id
 * and the Tawk.to live-chat widget. Stored as JSON in lp_site_settings (key
 * "tracking"), editable at /panel/tracking, with env fallbacks
 * (NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_TAWK_PROPERTY_ID / _WIDGET_ID) so the same
 * values can also be set in Vercel.
 *
 * Tawk lives here rather than in the component because the ids used to be
 * hardcoded ADM.UIUX ones — which meant every niche storefront on this
 * deployment opened a support chat belonging to a different business. Same
 * class of leak as a shared favicon, and the same fix: it is per-site data.
 */

export type TrackingConfig = {
  gtmId: string; // "GTM-XXXXXXX" or "" when disabled
  /** Tawk.to property (24 hex chars) — "" disables the chat entirely. */
  tawkPropertyId: string;
  /** Tawk.to widget id, the second path segment of the embed URL. */
  tawkWidgetId: string;
};

export const DEFAULT_TRACKING: TrackingConfig = {
  gtmId: "",
  tawkPropertyId: "",
  tawkWidgetId: "",
};

/** GTM container ids look like GTM-XXXXXXX (letters/digits after the prefix). */
export function normalizeGtmId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let v = raw.trim().toUpperCase();
  if (!v) return "";
  if (!v.startsWith("GTM-")) v = `GTM-${v.replace(/^GTM-?/, "")}`;
  return /^GTM-[A-Z0-9]{4,20}$/.test(v) ? v : "";
}

/**
 * A Tawk property id: 24 lowercase hex characters, the first path segment of
 * `https://embed.tawk.to/<property>/<widget>`.
 */
export function normalizeTawkPropertyId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim().toLowerCase();
  return /^[0-9a-f]{24}$/.test(v) ? v : "";
}

/**
 * A Tawk widget id — the second path segment. Tawk does not document a format
 * beyond "alphanumeric", and `default` is a real value it hands out, so this
 * only bounds the length and the alphabet rather than inventing a shape.
 */
export function normalizeTawkWidgetId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim().toLowerCase();
  return /^[0-9a-z]{4,30}$/.test(v) ? v : "";
}

/**
 * Pull the two ids out of whatever the admin pasted.
 *
 * What people actually have to hand is the snippet Tawk gives them, or the URL
 * out of it — not two ids they have split apart themselves. Accepting the URL
 * means the common case is one paste into one field instead of a hunt through
 * a `<script>` block, and it costs one regex.
 */
export function parseTawkEmbed(raw: unknown): { propertyId: string; widgetId: string } | null {
  if (typeof raw !== "string") return null;
  const m = /embed\.tawk\.to\/([0-9a-fA-F]{24})\/([0-9a-zA-Z]{1,30})/.exec(raw);
  if (!m) return null;
  const propertyId = normalizeTawkPropertyId(m[1]);
  const widgetId = normalizeTawkWidgetId(m[2]);
  return propertyId && widgetId ? { propertyId, widgetId } : null;
}

export function normalizeTracking(raw: unknown): TrackingConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const propertyId = normalizeTawkPropertyId(obj.tawkPropertyId);
  const widgetId = normalizeTawkWidgetId(obj.tawkWidgetId);
  return {
    gtmId: normalizeGtmId(obj.gtmId),
    // Both or neither: half a pair builds an embed URL that 404s, and a chat
    // that silently fails to load is worse than one that is plainly switched off.
    tawkPropertyId: propertyId && widgetId ? propertyId : "",
    tawkWidgetId: propertyId && widgetId ? widgetId : "",
  };
}

/** Is the live chat configured for this storefront? */
export function tawkEnabled(cfg: TrackingConfig): boolean {
  return !!cfg.tawkPropertyId && !!cfg.tawkWidgetId;
}
