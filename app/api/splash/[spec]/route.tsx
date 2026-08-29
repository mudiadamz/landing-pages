import { ImageResponse } from "next/og";
import { parseSplashSpec, SPLASH_MARK_RATIO } from "@/lib/ios-splash";
import { currentOrigin, currentSite } from "@/lib/site-resolve";
import { siteAppearance } from "@/lib/site-appearance";
import { resolveTemplate } from "@/lib/templates/registry";
import { IMAGE_CACHE_HEADERS, loadMark, markElement } from "@/lib/brand-raster";

/**
 * The iOS launch image for THIS storefront.
 *
 * Rendered per host instead of shipped as files, because a file in public/ is
 * one image for every domain — see lib/ios-splash.ts. The URL carries a `?v=`
 * fingerprint of the name/icon/colours, so this can be cached at the CDN for a
 * year and still change the moment a storefront rebrands.
 *
 * Not under a size the caller picks: parseSplashSpec only answers for the 17
 * device sizes we actually declare (see the note there).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ spec: string }> },
) {
  const { spec } = await ctx.params;
  const target = parseSplashSpec(spec);
  if (!target) return new Response("Not found", { status: 404 });

  const [site, origin] = await Promise.all([currentSite(), currentOrigin()]);
  const look = siteAppearance(site, resolveTemplate(site.template));
  const bg = target.scheme === "dark" ? look.backgroundDark : look.background;
  const mark = await loadMark(look.iconUrl, origin);
  const box = Math.round(Math.min(target.width, target.height) * SPLASH_MARK_RATIO);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
        }}
      >
        {markElement(look, mark, box, bg)}
      </div>
    ),
    { width: target.width, height: target.height, headers: IMAGE_CACHE_HEADERS },
  );
}
