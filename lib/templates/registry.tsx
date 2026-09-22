import type { LandingPagePublic, LandingPageCategory, HomepageSort } from "@/lib/actions/landing-pages";
import type { HeroConfig } from "@/lib/hero-config";
import type { PublicReview } from "@/lib/actions/reviews";
import type { Site } from "@/lib/site-resolve";
import type { SiteBrand } from "@/lib/site-brand";
import type { Surfaces } from "@/lib/palette";
import type { FounderCard } from "@/lib/content-config";
import type { HomepageListing } from "@/lib/actions/landing-pages";
import type { OtherLink } from "@/lib/actions/site-settings";
import type { SocialUrls } from "@/lib/social";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DefaultHome } from "./default/home";
import { DefaultCategory } from "./default/category";
import { DefaultCategories } from "./default/categories";
import { PustakaHome } from "./pustaka/home";
import { PustakaHeader } from "./pustaka/header";
import { PustakaFooter } from "./pustaka/footer";
import { PustakaCategory } from "./pustaka/category";
import { PustakaCategories } from "./pustaka/categories";
import { LinkbioHome } from "./linkbio/home";
import { LinkbioHeader, LinkbioFooter } from "./linkbio/chrome";
import { LinkbioCategory, LinkbioCategories } from "./linkbio/category";
import { MbahgptHome } from "./mbahgpt/home";
import { MbahgptHeader, MbahgptFooter } from "./mbahgpt/chrome";
import { MbahgptCategory, MbahgptCategories } from "./mbahgpt/category";
import type { Locale } from "@/lib/i18n";

/**
 * Frontend templates, so storefronts in different niches don't all look like a
 * template marketplace.
 *
 * A template is a component plus a label, registered here. Adding one for a new
 * niche is: write the component, add an entry, done — no migration and no change
 * to app/page.tsx, because `lp_sites.template` is a free-text column validated
 * against this object rather than a DB enum.
 *
 * Every template receives the SAME props. That is the contract: a template decides
 * how a storefront looks, never what data it can see. Data stays in
 * app/page.tsx so per-site catalog filtering and caching can't be forgotten by a
 * future template.
 */

export type TemplateProps = {
  site: Site;
  /**
   * The language THIS request renders in — the visitor's footer choice if they
   * made one, otherwise site.locale. Separate from site.locale on purpose: that
   * field is the stored default, and a template that reached for it would
   * ignore the switcher.
   */
  locale: Locale;
  pages: LandingPagePublic[];
  categories: LandingPageCategory[];
  reviews: PublicReview[];
  reviewCounts: Record<string, number>;
  hero: HeroConfig;
  sort: HomepageSort;
  user: { id: string } | null;
  /**
   * The founder card from site content — the person behind the storefront.
   *
   * Passed in rather than fetched by the template: presentation does not fetch
   * (see docs/architecture.md §2), and this is the same card the checkout page
   * already renders, so the two can never drift into two different people.
   */
  founder: FounderCard;
  /**
   * Paging state for `pages`, which is now ONE page of the catalogue rather than
   * all of it. A template that ignores this still renders correctly — it just
   * shows the first page and no pager.
   */
  listing: HomepageListing;
  /** The active search term, echoed back so a template can prefill its field. */
  query: string;
  /** Category slugs currently toggled on. Empty = the whole catalogue. */
  activeCategories: string[];
  /** The owner's other sites, shown behind the link icon. Empty = no icon. */
  otherLinks: OtherLink[];
  /** Per-network social addresses; a blank one hides that icon. */
  socialUrls: SocialUrls;
};

/**
 * Chrome props, matching what the shared header has always taken so a template can
 * be swapped in without touching the twelve pages that render it.
 */
export type ChromeProps = {
  user: { id: string; email?: string | null; user_metadata?: { full_name?: string | null } | null } | null;
  categories?: LandingPageCategory[];
  /** Highlights the browsed category in whatever nav the template draws. */
  currentCategorySlug?: string | null;
  /**
   * This storefront's name, logo and icon. REQUIRED, not defaulted: the shared
   * header is a client component and cannot resolve the site itself, and an
   * optional brand would let a new surface quietly render the Storefront mark on
   * somebody else's domain. Callers pass siteBrand(site); the TemplateHeader
   * dispatcher resolves it for the pages that don't already hold the site row.
   */
  brand: SiteBrand;
};

export type CategoryTemplateProps = Omit<TemplateProps, "hero" | "founder" | "listing" | "query" | "activeCategories" | "otherLinks" | "socialUrls"> & {
  category: LandingPageCategory;
};

export type CategoriesTemplateProps = {
  site: Site;
  categories: LandingPageCategory[];
  user: { id: string } | null;
  locale: Locale;
};

export type TemplateDef = {
  key: string;
  /** Shown in the panel picker. */
  label: string;
  /** One line on who it suits — this is what makes the picker usable. */
  description: string;
  /** Homepage body AND frame. */
  Home: (props: TemplateProps) => React.ReactNode;
  /**
   * Site-wide chrome. Rendered on every public page — product preview, checkout,
   * category listings, legal pages — not just the homepage, so a storefront doesn't
   * change identity the moment a visitor clicks through. Both may be async server
   * components, which is why the return type is loose.
   */
  Header: (props: ChromeProps) => React.ReactNode;
  Footer: () => React.ReactNode;
  /**
   * OPTIONAL slots. A template overrides only the surfaces its niche actually
   * changes; anything left undefined falls back to the marketplace version, so
   * adding a template never means reimplementing the whole site.
   *
   * Pages deliberately NOT slotted, because a niche has no reason to differ:
   *   /preview/[slug]            chrome-free fullscreen preview by design
   *   /checkout/*           a payment flow; divergence here buys risk, not identity
   *   /privacy /terms /refund  legal text, identical obligations on every domain
   *   /about /contact /hiring  parent-brand pages
   *   /read/[slug]          the reader, owned by the product not the storefront
   * Add a slot here when a real niche difference appears — not in advance.
   */
  Category?: (props: CategoryTemplateProps) => React.ReactNode;
  /** Category index (/categories). */
  Categories?: (props: CategoriesTemplateProps) => React.ReactNode;
  /**
   * Whether this template's Footer mounts the fixed mobile bottom nav.
   *
   * Anything else that fixes itself to the bottom edge — the checkout CTA bar —
   * has to sit above that nav or cover it. Declared here rather than sniffed,
   * because only the template knows what chrome it draws, and a fourth template
   * that adds a nav would otherwise silently start hiding the buy button.
   */
  hasBottomNav?: boolean;
  /**
   * The homepage is a full-viewport app that owns the bottom edge of the screen.
   *
   * Read in app/layout.tsx and handed to the site-wide floating widgets, which
   * match it against the live pathname themselves — the layout cannot, because
   * its own pathname comes from a header and a header is only read on a full
   * document load. Declared rather than sniffed, for the same reason as
   * `hasBottomNav`: only the template knows what it draws, and the alternative is
   * a support bubble parked on top of a send button — which is exactly what the
   * Tawk launcher did on the chat template before this existed.
   */
  fullscreenHome?: boolean;
  /**
   * Template renders in light only — no dark variant, and no theme switch.
   *
   * Read in app/layout.tsx, which drops the `dark` class and stops the inline
   * theme script re-applying it, so there is no flash of the wrong theme and no
   * way for a cookie set on another storefront to arrive dark. A template that
   * declares this must also not render ThemeSwitch: a toggle that does nothing
   * is worse than no toggle.
   */
  lightOnly?: boolean;
  /**
   * Page and card colours this template paints itself on, overriding the fixed
   * pair in globals.css. A light-grey page with white cards separates the two
   * without a border, which is what lets a flat design have layers at all.
   *
   * The panel re-asserts its own (PANEL_SURFACES), so a storefront's choice
   * never leaks into the admin UI on the same domain.
   */
  surfaces?: Surfaces;
  /**
   * Palette preset this theme was designed against. Only a SUGGESTION shown in the
   * panel — the palette is stored per domain, so two sites on one theme can differ,
   * and an admin's explicit choice is never overwritten.
   */
  defaultPalette?: string;
};

export const TEMPLATES: Record<string, TemplateDef> = {
  default: {
    key: "default",
    label: "Marketplace",
    description:
      "Tampilan Storefront sekarang: hero besar, grid kartu 3 kolom, testimoni, FAQ. Cocok untuk katalog campuran — template, aset, ebook.",
    Home: DefaultHome,
    // The chrome the live site already ships. Untouched on purpose.
    Header: SiteHeader,
    Footer: SiteFooter,
    Category: DefaultCategory,
    Categories: DefaultCategories,
    hasBottomNav: true,
    defaultPalette: "forest",
  },
  pustaka: {
    key: "pustaka",
    label: "Pustaka",
    description:
      "Rak buku: sampul portrait besar, tanpa hero mockup, fokus ke judul & harga. Cocok untuk niche ebook, novel, atau bacaan.",
    Home: PustakaHome,
    Header: PustakaHeader,
    Footer: PustakaFooter,
    Category: PustakaCategory,
    Categories: PustakaCategories,
    hasBottomNav: true,
    defaultPalette: "ink",
  },
  linkbio: {
    key: "linkbio",
    label: "Link in bio",
    description:
      "Satu kolom ala Linktree: foto profil, bio, lalu tumpukan tombol. Tanpa header di halaman depan. Cocok untuk bio Instagram/TikTok — semua yang dijual jadi satu daftar yang bisa di-tap.",
    Home: LinkbioHome,
    Header: LinkbioHeader,
    Footer: LinkbioFooter,
    Category: LinkbioCategory,
    Categories: LinkbioCategories,
    // A warm page, kept light: #f0e7e0 was warm enough to read as a colour
    // rather than as paper, which is a lot of wall behind a bio card.
    //
    // The card lifts to #fffdfb as the page lightens. Separation is what a flat
    // design has instead of shadows, and it shrinks as the two colours converge
    // — at 1.13 this holds the 1.125 the original grey/white pair had, so the
    // rows read as raised for exactly the same reason they used to.
    //
    // Still off-white and not #fff: against a warm page a pure white card reads
    // blue, and the row stops looking like the same wall lit differently.
    surfaces: { background: "#f5eee8", card: "#fffdfb" },
    defaultPalette: "breeze",
  },
  mbahgpt: {
    key: "mbahgpt",
    label: "MbahGPT (chat)",
    description:
      "Chatbox penuh layar ala ChatGPT: daftar percakapan di kiri, jawaban streaming, lampiran gambar/PDF, memori, dan pencarian web otomatis. Butuh OPENROUTER_API_KEY di server. Cocok untuk situs yang produknya adalah asistennya sendiri.",
    Home: MbahgptHome,
    Header: MbahgptHeader,
    Footer: MbahgptFooter,
    Category: MbahgptCategory,
    Categories: MbahgptCategories,
    // No bottom nav: the composer is already fixed to the bottom edge, and two
    // things fighting for that strip on a phone means one of them wins by accident.
    hasBottomNav: false,
    fullscreenHome: true,
    // Aged paper, and a card a shade nearer white so a bubble still lifts off it.
    //
    // This is the one place the poster's parchment is allowed to be literal, and
    // it is deliberately WEAKER than the poster: at full strength the ground
    // starts competing with a long transcript, which is long-form reading. The
    // ornament carries the theme; the paper only has to agree with it.
    surfaces: { background: "#f5edda", card: "#fffaf0", rule: "#cbb583" },
    defaultPalette: "wayang",
  },
};

export const DEFAULT_TEMPLATE = "default";

/** Unknown or removed template names degrade to the standard storefront. */
export function resolveTemplate(key: string | null | undefined): TemplateDef {
  const k = (key ?? "").trim();
  return TEMPLATES[k] ?? TEMPLATES[DEFAULT_TEMPLATE];
}

/** For the panel picker. */
export function templateOptions(): TemplateDef[] {
  return Object.values(TEMPLATES);
}

/** Serialisable view for the panel: no components cross the client boundary. */
export function templatePickerOptions() {
  return Object.values(TEMPLATES).map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    defaultPalette: t.defaultPalette ?? null,
    coverage: templateCoverage(t),
  }));
}

/**
 * The category page for a template, falling back to the marketplace one.
 *
 * The fallback is what makes the optional slots honest: a template with no
 * Category still renders a correct, complete page instead of nothing.
 */
export function resolveCategory(key: string | null | undefined) {
  return resolveTemplate(key).Category ?? DefaultCategory;
}

export function resolveCategories(key: string | null | undefined) {
  return resolveTemplate(key).Categories ?? DefaultCategories;
}

/**
 * Which surfaces a template actually defines, derived from the registry itself.
 *
 * Read live rather than maintained by hand, so it cannot drift: add a slot to a
 * template and the panel shows it. This is how you check a new theme is complete
 * without reading the code.
 */
export const TEMPLATE_SLOTS = [
  { key: "Home", label: "Halaman depan", required: true },
  { key: "Header", label: "Header & menu", required: true },
  { key: "Footer", label: "Footer", required: true },
  { key: "Category", label: "Halaman kategori", required: false },
  { key: "Categories", label: "Daftar kategori", required: false },
] as const;

export function templateCoverage(def: TemplateDef): { label: string; own: boolean }[] {
  return TEMPLATE_SLOTS.map((slot) => ({
    label: slot.label,
    own: typeof (def as unknown as Record<string, unknown>)[slot.key] === "function",
  }));
}
