import type { MetadataRoute } from "next";
import { currentOrigin } from "@/lib/site-resolve";

/**
 * Per-domain, so each storefront points crawlers at its OWN sitemap. Reading the
 * request host makes this route dynamic instead of built once — which is the
 * point: a single baked-in origin would tell every niche domain to crawl
 * admuiux.com's sitemap.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await currentOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /preview (and its old /lp alias) give paid content away for free — they are
      // for buyers deciding, not for search. /read is the buyer's own reader.
      disallow: [
        "/panel",
        "/login",
        "/signup",
        "/auth",
        "/api",
        "/preview",
        "/lp",
        "/read",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
