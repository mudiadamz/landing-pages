/**
 * Text of the button on the checkout page that opens the preview.
 *
 * Free text, with a dropdown of ready-made wordings in the panel. It used to be
 * a closed set of three keywords ("product" | "buku" | "pages") mapped to
 * display text at render; rows saved back then still hold those keywords, so
 * readLabel() translates them and the panel normalises on load. Nothing needs a
 * data migration — the column was always plain text.
 *
 * Shared by the panel and the checkout page so the wording offered and the
 * wording rendered can't drift.
 */

export const DEFAULT_PREVIEW_LABEL = "Preview Product";

/** Offered in the panel dropdown, in order. Anything else is typed by hand. */
export const PREVIEW_LABEL_PRESETS = [
  DEFAULT_PREVIEW_LABEL,
  "Preview Buku",
  "Preview Pages",
  "Baca Buku",
];

/** Keyword → display text, for rows written before the field was free text. */
const LEGACY: Record<string, string> = {
  product: DEFAULT_PREVIEW_LABEL,
  buku: "Preview Buku",
  pages: "Preview Pages",
};

export const PREVIEW_LABEL_MAX = 40;

/** What the visitor sees. Empty falls back to the default. */
export function previewLabelText(raw?: string | null): string {
  const v = raw?.trim();
  if (!v) return DEFAULT_PREVIEW_LABEL;
  return LEGACY[v] ?? v;
}

/**
 * What the panel should show in its editor. Same as the rendered text, except
 * empty stays empty — the field's "Bawaan" option, not the literal default.
 */
export function previewLabelForEdit(raw?: string | null): string {
  const v = raw?.trim();
  return v ? previewLabelText(v) : "";
}
