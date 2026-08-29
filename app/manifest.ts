import type { MetadataRoute } from "next";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { currentSite } from "@/lib/site-resolve";
import { siteAppearance } from "@/lib/site-appearance";
import { resolveTemplate } from "@/lib/templates/registry";
import {
  ICON_512_SPEC,
  MASKABLE_192_SPEC,
  MASKABLE_512_SPEC,
  iconUrl,
} from "@/lib/pwa-icons";

/**
 * Web app manifest — makes the site installable ("Add to Home Screen") on
 * Chrome/Android/desktop. iOS ignores this for installability (it uses the
 * apple-touch-icon + Share sheet) but still reads name/theme.
 *
 * Per storefront, so a niche domain installs under its own name, mark AND
 * colours instead of ADM.UIUX's. Reading the host makes this route dynamic,
 * which is fine: it is one tiny JSON response fetched once per install prompt,
 * not on every page view.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [site, locale] = await Promise.all([currentSite(), requestLocale()]);
  const t = translator(locale);
  const template = resolveTemplate(site.template);
  const look = siteAppearance(site, template);
  const name = look.name;
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
    lang: locale,
    // The template's own page colour, not a fixed one. Android paints the splash
    // with `background_color` and only then loads the page; on a warm template
    // (linkbio, mbahgpt) a hardcoded #fdfcfb meant the install flashed white and
    // then repainted cream. Dark is deliberately not used here — the manifest
    // has one background, and the app opens light unless the visitor chose dark.
    background_color: look.background,
    theme_color: look.background,
    icons: manifestIcons(site.icon_url, look.version),
  };
}

/**
 * Three entries, each doing a different job:
 *
 *   any (upload)  the storefront's real file, unmodified and lossless — the best
 *                 version of the mark, used wherever nothing crops it.
 *   any (PNG)     the same mark rasterised, for the installers that will not take
 *                 an SVG (a few Android launchers, the Windows install dialog).
 *   maskable      drawn small on the storefront's background so an Android
 *                 launcher's circle crop takes wallpaper-coloured padding
 *                 instead of the logo's corners.
 *
 * A storefront with no upload of its own gets the ADM.UIUX default the same way
 * the rest of the branding does.
 */
function manifestIcons(uploaded: string | null, version: string): MetadataRoute.Manifest["icons"] {
  const generated = [
    { src: iconUrl(ICON_512_SPEC, version), sizes: "512x512", type: "image/png", purpose: "any" as const },
    { src: iconUrl(MASKABLE_192_SPEC, version), sizes: "192x192", type: "image/png", purpose: "maskable" as const },
    { src: iconUrl(MASKABLE_512_SPEC, version), sizes: "512x512", type: "image/png", purpose: "maskable" as const },
  ];
  const src = uploaded?.trim();
  if (!src) return generated;
  return [
    // `sizes: "any"` rather than an invented "512x512" — the upload is verified
    // square but its exact pixel size isn't recorded, and "any" is the honest
    // declaration for one square mark. Chrome accepts it for installability,
    // the same way it accepts an SVG icon.
    { src, sizes: "any", type: iconMime(src), purpose: "any" },
    ...generated,
  ];
}

/** From the stored extension, which the upload set from the file's real magic bytes. */
function iconMime(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
