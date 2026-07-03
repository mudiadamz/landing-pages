/* Shared hero types + defaults. Kept out of the "use server" action file so
 * plain (non-async) values can be imported by client & server components. */

export type HeroIcon = "shield" | "qr" | "infinity" | "user" | "star" | "download" | "clock" | "check";

export type HeroFeature = { icon: HeroIcon; title: string; subtitle: string };

export type HeroConfig = {
  /** Small pill above the heading. `{count}` is replaced with the live product count. */
  badge: string;
  /** Supports `*green*` (brand highlight) and `~script~` (handwritten accent) markup. */
  heading: string;
  /** Supports `*green*` markup. */
  subheading: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  features: HeroFeature[];
  /** Public URL of the right-side illustration. Empty → built-in fallback mockup. */
  imageUrl: string;
};

export const DEFAULT_HERO: HeroConfig = {
  badge: "{count} produk siap pakai · preview gratis",
  heading: "Produk digital siap pakai, live hari ini — ~tanpa ngoding.~",
  subheading:
    "Preview dulu *gratis*, tanpa daftar. Sukai? Bayar via QRIS, langsung download dan pakai hari ini. Garansi 7 hari uang kembali — dijamin langsung oleh Adam.",
  primaryLabel: "Lihat produk",
  primaryHref: "#templates",
  secondaryLabel: "Bagaimana cara beli?",
  secondaryHref: "#templates",
  features: [
    { icon: "shield", title: "Garansi 7 hari", subtitle: "uang kembali" },
    { icon: "qr", title: "Bayar QRIS", subtitle: "e-wallet" },
    { icon: "infinity", title: "Akses selamanya", subtitle: "tanpa langganan" },
    { icon: "user", title: "Dibuat sendiri", subtitle: "oleh Adam" },
  ],
  imageUrl: "",
};

/** Merge a partial/parsed value onto the defaults so missing keys never break render. */
export function normalizeHero(raw: unknown): HeroConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_HERO;
  const v = raw as Partial<HeroConfig>;
  const features =
    Array.isArray(v.features) && v.features.length > 0
      ? v.features.slice(0, 4).map((f) => ({
          icon: (f?.icon ?? "check") as HeroIcon,
          title: String(f?.title ?? ""),
          subtitle: String(f?.subtitle ?? ""),
        }))
      : DEFAULT_HERO.features;
  return {
    badge: v.badge ?? DEFAULT_HERO.badge,
    heading: v.heading ?? DEFAULT_HERO.heading,
    subheading: v.subheading ?? DEFAULT_HERO.subheading,
    primaryLabel: v.primaryLabel ?? DEFAULT_HERO.primaryLabel,
    primaryHref: v.primaryHref ?? DEFAULT_HERO.primaryHref,
    secondaryLabel: v.secondaryLabel ?? DEFAULT_HERO.secondaryLabel,
    secondaryHref: v.secondaryHref ?? DEFAULT_HERO.secondaryHref,
    features,
    imageUrl: v.imageUrl ?? DEFAULT_HERO.imageUrl,
  };
}
