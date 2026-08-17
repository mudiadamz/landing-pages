import type { MessageKey } from "@/lib/i18n";

/**
 * Ready-made bundle wording, so the note under a bundle stays consistent across
 * products instead of being retyped each time. "Lainnya…" still allows anything.
 *
 * Lifted out of product-edit-form when the delivery tab moved: a list of strings
 * is not part of a form component, it is data the form happens to render.
 */
export const BUNDLE_NOTES: MessageKey[] = [
  "product.bundleNoteAll",
  "product.bundleNoteOnePayment",
  "product.bundleNoteCheaper",
  "product.bundleNoteInstant",
  "product.bundleNoteCollection",
];
