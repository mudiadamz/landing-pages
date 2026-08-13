/**
 * The three shapes a buyer's file can take. A product has exactly one.
 *
 * Its own module because the form, the delivery tab and the preview tab all
 * need it, and the preview tab's two "use the deliverable" modes only typecheck
 * against the same union the delivery tab writes.
 */
export type DeliverableType = "zip" | "pdf" | "epub";
