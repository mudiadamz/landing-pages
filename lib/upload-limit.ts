/** Uniform max size for product-form file uploads (thumbnail, preview & deliverable). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_UPLOAD_LABEL = "10 MB";

/**
 * Images uploaded by anyone who is not an admin.
 *
 * Only images. A seller's DELIVERABLE — the ZIP, PDF or EPUB they actually
 * sell — keeps the 10 MB cap, because capping that at 2 MB would stop them
 * selling most books. What this bounds is the pictures: a thumbnail, a hero, an
 * asset in the library, none of which render above a few hundred pixels, so a
 * 6 MB phone photo is only ever bytes the storefront pays to serve.
 */
export const IMAGE_MAX_BYTES_NON_ADMIN = 2 * 1024 * 1024; // 2 MB
export const IMAGE_MAX_LABEL_NON_ADMIN = "2 MB";

export const isImageType = (type: string | null | undefined) => !!type?.startsWith("image/");

export const imageMaxBytes = (isAdmin: boolean) =>
  isAdmin ? MAX_UPLOAD_BYTES : IMAGE_MAX_BYTES_NON_ADMIN;

export const imageMaxLabel = (isAdmin: boolean) =>
  isAdmin ? MAX_UPLOAD_LABEL : IMAGE_MAX_LABEL_NON_ADMIN;
