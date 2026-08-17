import type { MetadataRoute } from "next";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { currentSite } from "@/lib/site-resolve";
import { DEFAULT_ICON_192, DEFAULT_ICON_512 } from "@/lib/site-brand";

/**
 * Web app manifest — makes the site installable ("Add to Home Screen") on
 * Chrome/Android/desktop. iOS ignores this for installability (it uses the
 * apple-touch-icon + Share sheet) but still reads name/theme.
 *
 * Per storefront, so a niche domain installs under its own name and mark instead
 * of ADM.UIUX's. Reading the host makes this route dynamic, which is fine: it is
 * one tiny JSON response fetched once per install prompt, not on every page view.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [site, locale] = await Promise.all([currentSite(), requestLocale()]);
  const t = translator(locale);
  const name = site.name?.trim() || "ADM.UIUX";
  const fullName = site.tagline?.trim() ? `${name} — ${site.tagline.trim()}` : name;

  return {
    name: fullName,
    short_name: name,
    description:
      site.description?.trim() ||
      t("home.manifestDescription"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Not palette-derived: the palette only moves the four mood tokens, and the page
    // background stays this colour in every preset. A splash that didn't match the
    // first paint would flash.
    background_color: "#fdfcfb",
    theme_color: "#fdfcfb",
    icons: site.icon_url
      ? [
          // `sizes: "any"` rather than an invented "512x512" — the upload is verified
          // square but its exact pixel size isn't recorded, and "any" is the honest
          // declaration for one square mark. Chrome accepts it for installability,
          // the same way it accepts an SVG icon.
          { src: site.icon_url, sizes: "any", type: iconMime(site.icon_url), purpose: "any" },
          { src: site.icon_url, sizes: "any", type: iconMime(site.icon_url), purpose: "maskable" },
        ]
      : [
          { src: DEFAULT_ICON_192, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: DEFAULT_ICON_512, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: DEFAULT_ICON_512, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
  };
}

/** From the stored extension, which the upload set from the file's real magic bytes. */
function iconMime(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
