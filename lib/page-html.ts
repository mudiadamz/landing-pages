/**
 * Clean the HTML a page editor produces.
 *
 * An admin authored it, and an admin can already inject site-wide JavaScript at
 * /panel/custom-js — so this is not a trust boundary against them. It is a
 * boundary against a stored mistake: a pasted widget, an ad snippet, a tracking
 * pixel copied out of somebody's email. Those become a script on every visitor's
 * page forever, and the editor gives no sign that they are there.
 *
 * Deliberately a blocklist of what executes rather than an allowlist of tags:
 * the point is to keep rich text rich — tables, headings, images, embeds people
 * paste from their own site — while removing the parts that run.
 */
const EXECUTABLE = /<\s*(script|iframe|object|embed|form|link|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi;

export function sanitizePageHtml(html: string): string {
  return (html ?? "")
    .replace(EXECUTABLE, "")
    // Inline handlers: onclick=, onerror=, onload= …
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    // javascript: in any attribute that takes a URL.
    .replace(/\s(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "")
    .slice(0, 200_000);
}
