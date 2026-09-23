/**
 * Indonesian bank codes (Bank Indonesia "sandi bank"), the identifier a
 * disbursement API addresses a destination by.
 *
 * A business types its bank NAME for humans to read; a transfer needs the code.
 * The two are kept as separate fields rather than derived from each other: name
 * matching would have to guess between "BCA", "Bank BCA" and "bca syariah", and
 * a wrong guess here sends real money to a real stranger.
 *
 * Not exhaustive — the banks people actually get paid into. A bank that isn't
 * listed simply has no automatic disbursement; the manual payout path still
 * records it, so nobody is blocked from being paid.
 *
 * Framework-free so the panel form and the server action share one list.
 */

export type Bank = { code: string; name: string };

export const BANKS: Bank[] = [
  { code: "002", name: "BRI" },
  { code: "008", name: "Mandiri" },
  { code: "009", name: "BNI" },
  { code: "011", name: "Danamon" },
  { code: "013", name: "Permata" },
  { code: "014", name: "BCA" },
  { code: "016", name: "Maybank Indonesia" },
  { code: "019", name: "Panin" },
  { code: "022", name: "CIMB Niaga" },
  { code: "023", name: "UOB Indonesia" },
  { code: "028", name: "OCBC Indonesia" },
  { code: "031", name: "Citibank" },
  { code: "037", name: "Artha Graha" },
  { code: "050", name: "Standard Chartered" },
  { code: "087", name: "HSBC Indonesia" },
  { code: "110", name: "Bank BJB" },
  { code: "111", name: "Bank DKI" },
  { code: "147", name: "Muamalat" },
  { code: "153", name: "Sinarmas" },
  { code: "200", name: "BTN" },
  { code: "213", name: "BTPN / Jenius" },
  { code: "426", name: "Mega" },
  { code: "441", name: "KB Bukopin" },
  { code: "451", name: "Bank Syariah Indonesia (BSI)" },
  { code: "490", name: "Neo Commerce" },
  { code: "501", name: "Blu by BCA Digital" },
  { code: "535", name: "SeaBank" },
  { code: "542", name: "Bank Jago" },
  { code: "567", name: "Allo Bank" },
];

const BY_CODE = new Map(BANKS.map((b) => [b.code, b]));

/** The bank for a code, or null. Unknown codes are never invented. */
export function bankByCode(code: string | null | undefined): Bank | null {
  return BY_CODE.get((code ?? "").trim()) ?? null;
}

/** A code we recognise, or null — what the form and the action both validate against. */
export function normalizeBankCode(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return BY_CODE.has(s) ? s : null;
}
