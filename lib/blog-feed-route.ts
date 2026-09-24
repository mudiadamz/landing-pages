import { currentOrigin, currentSite } from "@/lib/site-resolve";
import { getBlogFeed } from "@/lib/actions/blog";
import { atomFeed, rssFeed } from "@/lib/blog-feed";

/**
 * One handler behind every feed address this blog answers on.
 *
 * Blogger published the same content at /feeds/posts/default (Atom),
 * /feeds/posts/default?alt=rss, /atom.xml and /rss.xml. All four are in
 * somebody's reader, so all four answer here rather than three of them
 * redirecting — a redirect chain is one more thing that can be dropped by a
 * ten-year-old feed client.
 */
export async function serveBlogFeed(request: Request, format: "atom" | "rss" | "auto") {
  const url = new URL(request.url);
  const wantsRss = format === "rss" || (format === "auto" && url.searchParams.get("alt") === "rss");

  const [site, origin, listing] = await Promise.all([
    currentSite(),
    currentOrigin(),
    // 25 is Blogger's own default for max-results on this endpoint.
    getBlogFeed(1),
  ]);

  const posts = listing.items.slice(0, 25);
  const input = {
    title: site.name,
    subtitle: site.tagline?.trim() || site.description?.trim() || null,
    origin,
    posts,
    updated: posts[0]?.publishedAt ?? new Date().toISOString(),
  };

  return new Response(wantsRss ? rssFeed(input) : atomFeed(input), {
    headers: {
      "content-type": wantsRss
        ? "application/rss+xml; charset=utf-8"
        : "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}
