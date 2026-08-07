import type { LandingPagePublic, LandingPageCategory, HomepageSort } from "@/lib/actions/landing-pages";
import type { HeroConfig } from "@/lib/hero-config";
import type { PublicReview } from "@/lib/actions/reviews";
import type { Site } from "@/lib/site-resolve";
import { DefaultHome } from "./default/home";
import { PustakaHome } from "./pustaka/home";

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
  pages: LandingPagePublic[];
  categories: LandingPageCategory[];
  reviews: PublicReview[];
  reviewCounts: Record<string, number>;
  hero: HeroConfig;
  sort: HomepageSort;
  user: { id: string } | null;
};

export type TemplateDef = {
  key: string;
  /** Shown in the panel picker. */
  label: string;
  /** One line on who it suits — this is what makes the picker usable. */
  description: string;
  Home: (props: TemplateProps) => React.ReactNode;
};

export const TEMPLATES: Record<string, TemplateDef> = {
  default: {
    key: "default",
    label: "Marketplace",
    description:
      "Tampilan ADM.UIUX sekarang: hero besar, grid kartu 3 kolom, testimoni, FAQ. Cocok untuk katalog campuran — template, aset, ebook.",
    Home: DefaultHome,
  },
  pustaka: {
    key: "pustaka",
    label: "Pustaka",
    description:
      "Rak buku: sampul portrait besar, tanpa hero mockup, fokus ke judul & harga. Cocok untuk niche ebook, novel, atau bacaan.",
    Home: PustakaHome,
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
