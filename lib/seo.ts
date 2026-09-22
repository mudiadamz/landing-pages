import { richTextToPlain } from "@/lib/html-sanitize";

/** Canonical site origin. Falls back to the production domain, never a placeholder. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

/**
 * Build a clean meta/OG description from free-text product copy. Strips markdown
 * tokens (so raw "* …" / "#" don't leak into search snippets), collapses
 * whitespace, and clamps to ~160 chars. Falls back when copy is too thin.
 */
export function buildMetaDescription(
  text: string | null | undefined,
  fallback: string,
): string {
  const cleaned = richTextToPlain(text)
    .replace(/[*_#>`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned.length >= 40 ? cleaned : fallback;
  return base.length > 160 ? `${base.slice(0, 157).trimEnd()}…` : base;
}

/**
 * Clean leaked markdown for on-screen product copy: turns "* "/"- " bullets into
 * "• " and strips * / ** emphasis tokens, while preserving line breaks. Use for
 * visible long_description text (meta uses buildMetaDescription instead).
 */
export function normalizeDescription(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*[*-]\s+/, "• ")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1"),
    )
    .join("\n")
    .trim();
}
