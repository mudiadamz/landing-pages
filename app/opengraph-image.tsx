import { ImageResponse } from "next/og";
import { currentOrigin, currentSite } from "@/lib/site-resolve";
import { resolveTemplate } from "@/lib/templates/registry";
import { paletteFromKey } from "@/lib/palette";
import { readableInk, siteAppearance } from "@/lib/site-appearance";
import { loadMark } from "@/lib/brand-raster";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export const alt = "Produk siap pakai";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The default social card, per storefront.
 *
 * It used to be one image with "Storefront" and "admuiux.com" baked into it, which
 * every domain shared — so a link to a niche storefront previewed on WhatsApp or
 * Facebook as somebody else's brand. Reading the host makes this route dynamic;
 * that is the same trade app/manifest.ts makes, and a social card is fetched by
 * a crawler once per URL, not by visitors.
 *
 * Pages with their own image (a product thumbnail) still override this.
 */
export default async function OpengraphImage() {
  const [site, origin, locale] = await Promise.all([
    currentSite(),
    currentOrigin(),
    requestLocale(),
  ]);
  const t = translator(locale);
  const template = resolveTemplate(site.template);
  const look = siteAppearance(site, template);
  const tokens = paletteFromKey(site.palette || template.defaultPalette).tokens;
  const mark = await loadMark(look.iconUrl, origin);

  const bg = look.background;
  const ink = readableInk(bg);
  const headline = site.tagline?.trim() || t("home.manifestDescription");
  const sub = site.description?.trim() || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: bg,
          padding: 72,
          fontFamily: "sans-serif",
          // The storefront's own accent as a top rule — enough palette to make two
          // domains on the same template look different, without inventing a
          // layout per template.
          borderTop: `16px solid ${tokens.primary}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {mark ? (
            // Rendered by satori into a PNG — see lib/brand-raster.tsx.
            <img src={mark} width={96} height={96} style={{ width: 96, height: 96, objectFit: "contain" }} alt="" />
          ) : null}
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: ink, letterSpacing: 1 }}>
            {look.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 62, fontWeight: 800, lineHeight: 1.15, color: ink }}>
            {clamp(headline, 90)}
          </div>
          {sub ? (
            <div style={{ display: "flex", fontSize: 30, lineHeight: 1.35, color: tokens.primary }}>
              {clamp(sub, 120)}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", fontSize: 26, color: ink, opacity: 0.65 }}>
          {site.host || new URL(origin).host}
        </div>
      </div>
    ),
    { ...size },
  );
}

/** Long copy has to stop somewhere — satori will not reflow it out of the frame. */
function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
