import type { BlogPostSummary } from "@/lib/actions/blog";

/**
 * Atom and RSS, at the addresses Blogger served them from.
 *
 * Feed readers keep a subscription for years and never revisit the site to look
 * for a new URL — if /feeds/posts/default stops answering, the subscriber does
 * not see a broken feed, they simply stop seeing the blog. So the path is
 * copied exactly, `?alt=rss` included.
 *
 * Built as strings rather than through a library: a feed is ten tags, and the
 * only hard part is escaping, which is one function.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type FeedInput = {
  title: string;
  subtitle: string | null;
  origin: string;
  posts: BlogPostSummary[];
  updated: string;
};

export function atomFeed({ title, subtitle, origin, posts, updated }: FeedInput): string {
  const entries = posts
    .map(
      (p) => `  <entry>
    <id>${esc(origin + p.path)}</id>
    <title type="text">${esc(p.title)}</title>
    <link rel="alternate" type="text/html" href="${esc(origin + p.path)}"/>
    <published>${esc(p.publishedAt)}</published>
    <updated>${esc(p.publishedAt)}</updated>
    <summary type="text">${esc(p.excerpt)}</summary>
${p.labels.map((l) => `    <category term="${esc(l)}"/>`).join("\n")}
  </entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${esc(origin)}/feeds/posts/default</id>
  <title type="text">${esc(title)}</title>
${subtitle ? `  <subtitle type="text">${esc(subtitle)}</subtitle>\n` : ""}  <updated>${esc(updated)}</updated>
  <link rel="alternate" type="text/html" href="${esc(origin)}/"/>
  <link rel="self" type="application/atom+xml" href="${esc(origin)}/feeds/posts/default"/>
${entries}
</feed>
`;
}

export function rssFeed({ title, subtitle, origin, posts, updated }: FeedInput): string {
  const items = posts
    .map(
      (p) => `    <item>
      <guid isPermaLink="true">${esc(origin + p.path)}</guid>
      <title>${esc(p.title)}</title>
      <link>${esc(origin + p.path)}</link>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      <description>${esc(p.excerpt)}</description>
${p.labels.map((l) => `      <category>${esc(l)}</category>`).join("\n")}
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(origin)}/</link>
    <description>${esc(subtitle ?? title)}</description>
    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}
