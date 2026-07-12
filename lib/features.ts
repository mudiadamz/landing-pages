/* Grantable admin features. A full admin (role='admin') implicitly has all of
 * them; other users can be delegated a subset via lp_profiles.permissions.
 * Kept framework-free so both client & server can import it. */

export const ADMIN_FEATURES = [
  { key: "stats", label: "Stats", href: "/panel/stats" },
  { key: "users", label: "Users", href: "/panel/users" },
  { key: "categories", label: "Kategori", href: "/panel/categories" },
  { key: "contacts", label: "Kontak", href: "/panel/contacts" },
  { key: "inbox", label: "Email masuk", href: "/panel/inbox" },
  { key: "hero", label: "Hero", href: "/panel/hero" },
  { key: "content", label: "Konten situs", href: "/panel/content" },
  { key: "custom-js", label: "Custom JS", href: "/panel/custom-js" },
] as const;

export type FeatureKey = (typeof ADMIN_FEATURES)[number]["key"];

export const ALL_FEATURE_KEYS: FeatureKey[] = ADMIN_FEATURES.map((f) => f.key);

const VALID = new Set<string>(ALL_FEATURE_KEYS);

/** Keep only recognised feature keys (drops unknown/legacy values). */
export function normalizeFeatures(value: unknown): FeatureKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is FeatureKey => typeof v === "string" && VALID.has(v));
}
