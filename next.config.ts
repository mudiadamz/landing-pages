import type { NextConfig } from "next";

function ownStorageHost() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return [];
  const u = new URL(site);
  return [
    {
      protocol: u.protocol.replace(":", "") as "http" | "https",
      hostname: u.hostname,
      port: u.port,
      pathname: "/storage/v1/object/public/**",
    },
  ];
}

const nextConfig: NextConfig = {
  /**
   * Jejak server yang berdiri sendiri, untuk image Docker.
   *
   * Tanpa ini, menjalankan Next di container berarti menyalin seluruh
   * node_modules (740 MB waktu masih pakai npm). Dengan standalone, Next
   * menelusuri modul yang BENAR-BENAR dipakai server dan menaruhnya di
   * .next/standalone — sisanya tidak ikut. Konsekuensinya: `public/` dan
   * `.next/static` TIDAK ikut tertelusur dan harus disalin sendiri di
   * Dockerfile; kalau lupa, situsnya jalan tapi tanpa CSS dan tanpa gambar.
   */
  output: "standalone",
  images: {
    remotePatterns: [
      // Stored files are served by this app (lib/backend/storage.ts) at
      // NEXT_PUBLIC_SITE_URL/storage/v1/object/public/…
      ...ownStorageHost(),
      // Rows written before the move still point at Supabase until
      // scripts/storage-migrate.mjs rewrite runs at cutover.
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
