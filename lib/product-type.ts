/* What a product IS, and what "delivered" means for it.
 *
 * Framework-free so the panel form, the server actions and the storefront can
 * all import it. Every rule about a product's kind lives here rather than as an
 * `=== "digital"` scattered across call sites — the catalog used to assume a
 * file everywhere, and the way that assumption spread is exactly what this
 * module exists to stop happening again with the next kind.
 *
 * The database holds the same two vocabularies as CHECK constraints
 * (20260924000000_product_types.sql). If a value is added there it must be
 * added here, and vice versa — tests/product-type.test.ts holds the pair
 * against the migration file so the two cannot drift silently.
 */

export const PRODUCT_TYPES = ["digital", "physical", "service"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const SERVICE_MODES = ["onsite", "remote", "both"] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];

export const FULFILLMENT_STATUSES = ["pending", "processing", "done", "cancelled"] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

const TYPES = new Set<string>(PRODUCT_TYPES);
const MODES = new Set<string>(SERVICE_MODES);
const STATUSES = new Set<string>(FULFILLMENT_STATUSES);

/**
 * Anything unrecognised — a null column on a row written before the type
 * existed, a hand-edited form field — reads as "digital".
 *
 * That default is not neutrality, it is the truth about this catalog: every row
 * that predates the column is a digital product, and the constraint that
 * refuses a bad value on write is the database's job, not this function's.
 */
export function normalizeProductType(value: unknown): ProductType {
  return typeof value === "string" && TYPES.has(value) ? (value as ProductType) : "digital";
}

export function normalizeServiceMode(value: unknown): ServiceMode | null {
  return typeof value === "string" && MODES.has(value) ? (value as ServiceMode) : null;
}

export function normalizeFulfillment(value: unknown): FulfillmentStatus {
  return typeof value === "string" && STATUSES.has(value)
    ? (value as FulfillmentStatus)
    : "pending";
}

/**
 * Does buying this hand over a file?
 *
 * The download route, the PDF/EPUB readers and the delivery tab all ask this.
 * They must NOT ask it of fulfillment_status: a physical order marked 'done'
 * still has no file, and a digital purchase still has one while its status says
 * 'pending'.
 */
export function deliversFile(type: ProductType): boolean {
  return type === "digital";
}

/** Only physical goods carry stock; a service has capacity, not inventory. */
export function tracksStock(type: ProductType): boolean {
  return type === "physical";
}

/**
 * The status a purchase of this product starts in.
 *
 * A digital product is delivered by the act of buying it — there is nothing for
 * a seller to do, and an order queue full of completed downloads would train
 * them to ignore it. Everything else starts as work to be done.
 */
export function initialFulfillment(type: ProductType): FulfillmentStatus {
  return deliversFile(type) ? "done" : "pending";
}

/**
 * Where an order may go from where it is.
 *
 * A finished order is finished: reopening 'done' would let a seller un-deliver
 * something the buyer already received, and the honest correction for that is a
 * refund, not a status change. 'cancelled' is likewise terminal — it is a
 * statement about an order, and un-cancelling one hides that it happened.
 */
export function nextFulfillmentStatuses(current: FulfillmentStatus): FulfillmentStatus[] {
  switch (current) {
    case "pending":
      return ["processing", "done", "cancelled"];
    case "processing":
      return ["done", "cancelled"];
    default:
      return [];
  }
}

/** Is this order still work for the seller? Drives the panel's open-orders count. */
export function isOpenOrder(status: FulfillmentStatus): boolean {
  return status === "pending" || status === "processing";
}
