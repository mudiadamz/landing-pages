import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes the site installable ("Add to Home Screen") on
 * Chrome/Android/desktop. iOS ignores this for installability (it uses the
 * apple-touch-icon + Share sheet) but still reads name/theme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ADM.UIUX — Template & Aset Digital",
    short_name: "ADM.UIUX",
    description:
      "Marketplace template landing page & aset digital siap pakai. Preview, beli, download.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfcfb",
    theme_color: "#fdfcfb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
