import { ImageResponse } from "next/og";
import { parseIconSpec } from "@/lib/pwa-icons";
import { currentOrigin, currentSite } from "@/lib/site-resolve";
import { siteAppearance } from "@/lib/site-appearance";
import { resolveTemplate } from "@/lib/templates/registry";
import { IMAGE_CACHE_HEADERS, loadMark, markElement } from "@/lib/brand-raster";

/**
 * The home-screen icon for THIS storefront, as a real PNG on a real background.
 *
 * Why not just point iOS and Android at `lp_sites.icon_url` (which the browser
 * tab already uses): that upload may be an SVG, which iOS won't take for an
 * apple-touch-icon, and it may be transparent, which iOS renders on black and
 * Android crops to a circle. See lib/pwa-icons.ts for which spec covers which.
 *
 * Always light: a home-screen icon sits on the user's wallpaper, not on our
 * page, so it must not follow the visitor's theme — an icon that changed colour
 * with the phone's dark mode would be re-rendered under a URL that says it is
 * immutable.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ spec: string }> },
) {
  const { spec } = await ctx.params;
  const icon = parseIconSpec(spec);
  if (!icon) return new Response("Not found", { status: 404 });

  const [site, origin] = await Promise.all([currentSite(), currentOrigin()]);
  const look = siteAppearance(site, resolveTemplate(site.template));
  const mark = await loadMark(look.iconUrl, origin);
  const box = Math.round(icon.size * icon.markRatio);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: look.background,
        }}
      >
        {markElement(look, mark, box, look.background)}
      </div>
    ),
    { width: icon.size, height: icon.size, headers: IMAGE_CACHE_HEADERS },
  );
}
