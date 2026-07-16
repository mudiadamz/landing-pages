import { sanitizeRichText, isProbablyHtml } from "@/lib/html-sanitize";
import { normalizeDescription } from "@/lib/seo";

/**
 * Renders a product's long description. New descriptions are rich-text HTML
 * (authored via RichTextEditor); legacy descriptions are plain text — detected
 * and rendered with preserved line breaks. HTML is always re-sanitized here.
 */
export function RichText({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;

  if (isProbablyHtml(text)) {
    const html = sanitizeRichText(text);
    if (!html) return null;
    return (
      <div
        className={`rich-text ${className ?? ""}`.trim()}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <p className={`whitespace-pre-wrap ${className ?? ""}`.trim()}>{normalizeDescription(text)}</p>;
}
