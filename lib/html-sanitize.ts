/**
 * Allowlist HTML sanitizer for publisher-authored rich text (product
 * descriptions). Content comes from a semi-trusted, admin-approved publisher and
 * is rendered to buyers via dangerouslySetInnerHTML, so it must be sanitized both
 * on write (before storing) and again at render (defense in depth).
 *
 * There is no DOMPurify/jsdom in this project, so this is a conservative,
 * regex-based allowlist: only a small set of formatting tags survive, all
 * attributes are dropped except a validated href on <a>, and script/style/embed
 * blocks are removed with their content.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
]);

/** Tags whose entire content is dropped (not just the tag). */
const DANGEROUS_BLOCK = /<(script|style|iframe|object|embed|noscript|template)[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_OPEN = /<\/?(script|style|iframe|object|embed|noscript|template)\b[^>]*>/gi;

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Allow only http(s), mailto, and in-page/relative links. */
function safeHref(raw: string): string | null {
  const value = raw.trim();
  const compact = value.replace(/\s+/g, "").toLowerCase();
  if (/^(https?:|mailto:)/.test(compact)) return value;
  if (value.startsWith("/") || value.startsWith("#")) return value;
  return null;
}

export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";

  let html = input;
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(DANGEROUS_BLOCK, "");
  html = html.replace(DANGEROUS_OPEN, "");

  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_match, slash, rawName, attrs) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (slash === "/") return `</${name}>`;
    if (name === "a") {
      const hrefMatch = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
      const rawHref = hrefMatch ? hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "" : "";
      const href = safeHref(rawHref);
      if (!href) return "";
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
    }
    // All other allowed tags: keep the tag, drop every attribute.
    return `<${name}>`;
  });

  return html.trim();
}

/** True when the string looks like it contains HTML markup. */
export function isProbablyHtml(text: string | null | undefined): boolean {
  if (!text) return false;
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

/** Strip tags/entities to a single-line plain-text string (for cards & meta). */
export function richTextToPlain(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(DANGEROUS_BLOCK, "")
    .replace(/<(br|\/p|\/h2|\/h3|\/li|\/ul|\/ol|\/blockquote)\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
