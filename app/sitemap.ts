import type { MetadataRoute } from "next";
import { getCategories, getLandingPagesForHomepage } from "@/lib/actions/landing-pages";
import { currentOrigin, currentSite } from "@/lib/site-resolve";

/**
 * One sitemap per domain. Reading the host makes this dynamic rather than built
 * once, which it has to be: each storefront lists only the products and
 * categories it actually carries, at its own origin. A shared static sitemap
 * would advertise every niche's products on every domain and read as duplicate
 * content.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await currentOrigin();
  const site = await currentSite();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Cached anon-client reads — safe to call at build/revalidate time.
  const [categories, pages] = await Promise.all([
    getCategories(),
    getLandingPagesForHomepage(),
  ]);

  // Only the categories this storefront carries: its own roots plus their
  // children. An empty niche list means the canonical site, which carries all.
  const niche = site.category_ids ?? [];
  const visibleCategories =
    niche.length === 0
      ? categories
      : categories.filter(
          (c) => niche.includes(c.id) || (c.parent_id && niche.includes(c.parent_id)),
        );

  const categoryRoutes: MetadataRoute.Sitemap = visibleCategories.map((c) => ({
    url: `${base}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  /**
   * Products point at CHECKOUT, not the preview.
   *
   * The preview is noindex now, so listing it here would be a sitemap that asks to
   * be crawled and a page that refuses — the worst of both. But dropping products
   * from the sitemap entirely would delete the whole catalogue from search, so the
   * indexable home for a product is /checkout/[slug]: it is public, it carries the
   * title, description, price and reviews, and it is where a search visitor should
   * land anyway.
   */
  const productRoutes: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${base}/checkout/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
