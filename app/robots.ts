import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://admuiux.com";

export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/panel", "/login", "/signup", "/auth", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
