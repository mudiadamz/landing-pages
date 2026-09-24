/* The shipping address a physical order needs, and what makes one valid.
 *
 * Framework-free, because the same answer has to be given in three places that
 * cannot share a runtime: the checkout form in the browser (so the buyer is
 * told before they pay), the free-claim Server Action, and the create-invoice
 * route. Three copies of "is this filled in" is three chances to disagree, and
 * the one that matters — the server — is the one nobody sees fail.
 *
 * It deliberately does NOT validate an address against reality. There is no
 * postcode database here, and a regex that rejects a real rural address is
 * worse than a field that accepts a typo: the seller can read it and call the
 * buyer, while a refused checkout just loses the sale.
 */

export type ShippingAddress = {
  name: string;
  phone: string;
  address: string;
  city: string;
  province: string | null;
  postalCode: string;
  note: string | null;
};

/** The fields an order cannot ship without. Province and note are optional. */
export const SHIPPING_REQUIRED = ["name", "phone", "address", "city", "postalCode"] as const;
export type ShippingField = keyof ShippingAddress;

const MAX = {
  name: 100,
  phone: 30,
  address: 300,
  city: 80,
  province: 80,
  postalCode: 12,
  note: 200,
} as const;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Read an address out of whatever the caller has — a parsed JSON body, a
 * FormData, a database row. Returns null when every field is blank, which is
 * how "no address was submitted" stays distinguishable from "an address was
 * submitted badly": the first is a product that doesn't need one, the second is
 * an error the buyer has to see.
 */
export function normalizeShipping(raw: unknown): ShippingAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const out: ShippingAddress = {
    name: str(v.name ?? v.shipping_name, MAX.name),
    phone: str(v.phone ?? v.shipping_phone, MAX.phone),
    address: str(v.address ?? v.shipping_address, MAX.address),
    city: str(v.city ?? v.shipping_city, MAX.city),
    province: str(v.province ?? v.shipping_province, MAX.province) || null,
    postalCode: str(v.postalCode ?? v.shipping_postal_code, MAX.postalCode),
    note: str(v.note ?? v.shipping_note, MAX.note) || null,
  };
  const empty =
    !out.name && !out.phone && !out.address && !out.city && !out.province && !out.postalCode && !out.note;
  return empty ? null : out;
}

/**
 * A phone number someone could actually be called on.
 *
 * Counts digits rather than matching a shape: +62, 0812-3456-7890 and
 * "0812 3456 7890" are the same number written three ways, and an Indonesian
 * mobile is 9–13 digits. The bound is loose on purpose — this rejects "ya" and
 * a mistyped postcode, not an unusual number.
 */
export function isPhoneLike(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Which required fields are missing or unusable. Empty array = ready to ship.
 *
 * A null address returns every required field rather than "no problems": an
 * order for a physical product with no address at all is the worst version of
 * this, not the exempt one.
 */
export function shippingProblems(value: ShippingAddress | null): ShippingField[] {
  if (!value) return [...SHIPPING_REQUIRED];
  const missing = SHIPPING_REQUIRED.filter((f) => !value[f]);
  if (!missing.includes("phone") && !isPhoneLike(value.phone)) missing.push("phone");
  return missing;
}

/** Ready to write to `lp_purchases` / `lp_pending_shipping`. */
export function shippingColumns(value: ShippingAddress) {
  return {
    shipping_name: value.name,
    shipping_phone: value.phone,
    shipping_address: value.address,
    shipping_city: value.city,
    shipping_province: value.province,
    shipping_postal_code: value.postalCode,
    shipping_note: value.note,
  };
}

/** One-line rendering for a panel row or an email. */
export function formatShipping(value: ShippingAddress): string {
  return [value.address, value.city, value.province, value.postalCode]
    .filter(Boolean)
    .join(", ");
}
