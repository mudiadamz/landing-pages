import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  experimental: {
    // ZIP uploads are sent to a Server Action as FormData; the default 1MB
    // limit is far too small for a full site bundle.
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },

  /**
   * The preview moved /lp/:slug -> /preview/:slug.
   *
   * This redirect is NOT optional housekeeping. Live Instagram/Facebook ads point
   * at /lp/... URLs, and so does every link already shared, every OG card already
   * scraped, and the confirmation emails already sent. Dropping the old path would
   * turn paid traffic into 404s.
   *
   * Permanent (308) so link equity and ad-platform caches follow it once.
   */
  async redirects() {
    return [
      { source: "/lp/:slug", destination: "/preview/:slug", permanent: true },
    ];
  },

  /**
   * The preview is paid content shown for free. Keep it out of search.
   *
   * X-Robots-Tag is belt to the page's own `robots: { index: false }` metadata:
   * the header applies even to responses a crawler fetches without parsing HTML
   * (HEAD requests, the epub-text JSON endpoints), and `noarchive`/`nosnippet` stop
   * the excerpt being served from a cache or quoted in a result even if the URL
   * itself is known.
   */
  async headers() {
    const noIndex = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
    };
    return [
      { source: "/preview/:path*", headers: [noIndex] },
      { source: "/lp/:path*", headers: [noIndex] },
      // The endpoints that serve the excerpt text/assets. Cheap to cover, and they
      // are the actual content a scraper would want.
      { source: "/api/epub-text/:path*", headers: [noIndex] },
      { source: "/api/epub-asset/:path*", headers: [noIndex] },
      { source: "/api/epub-cover/:path*", headers: [noIndex] },
    ];
  },
};

export default nextConfig;
