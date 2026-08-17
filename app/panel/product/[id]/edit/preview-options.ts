import type { PreviewType } from "@/lib/actions/landing-pages";
import type { MessageKey } from "@/lib/i18n";

/**
 * The six things "preview" can mean, and the one-line explanation each needs.
 *
 * Data, not UI: the radio row that renders these belongs to the preview tab,
 * but the list itself is the product's vocabulary and is worth reading in one
 * place without a component around it.
 *
 * Labels and hints are KEYS — this is module scope, so a resolved string would
 * be whichever language loaded first, for everyone after.
 */
export const PREVIEW_OPTIONS: {
  value: PreviewType;
  /** A format name reads the same in every language; the rest carry a key. */
  label?: string;
  labelKey?: MessageKey;
  hintKey: MessageKey;
}[] = [
  { value: "html", label: "HTML", hintKey: "product.previewHintHtml" },
  { value: "pdf", label: "PDF", hintKey: "product.previewHintPdf" },
  { value: "epub", label: "EPUB", hintKey: "product.previewHintEpub" },
  { value: "link", label: "Link", hintKey: "product.previewHintLink" },
  {
    value: "deliverable",
    labelKey: "product.previewSameAsDeliverable",
    hintKey: "product.previewHintDeliverable",
  },
  {
    value: "excerpt",
    labelKey: "product.previewPartOfDeliverable",
    hintKey: "product.previewHintExcerpt",
  },
];
