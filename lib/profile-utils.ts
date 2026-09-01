export type AccountType = "company" | "agent" | "customer";

export type PublisherStatus = "none" | "pending" | "approved" | "rejected";

/**
 * Jenis akun: **Company**, **Agent**, atau **Customer**.
 *
 * "Publisher" tidak ada di sini, dan itu perubahan arti, bukan penghapusan
 * nilai: publisher adalah seorang Customer yang boleh menjual **di sebuah
 * situs** — jadi ia flag pada keanggotaan (`lp_site_members.is_publisher`),
 * bukan jenis akun. Orang yang sama bisa publisher di satu storefront dan
 * pembeli biasa di storefront lain.
 *
 * Nilai lama masih dibaca: `'admin'`/`'company'` → Company, `'publisher'` →
 * Customer (izin jualnya ada di keanggotaan, bukan di sini). Baris yang entah
 * bagaimana kembali berisi nilai lama harus tetap dibaca dengan benar, bukan
 * diam-diam kehilangan tingkatannya.
 */
export function normalizeAccountType(value: unknown): AccountType {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "company" || s === "admin") return "company";
  if (s === "agent") return "agent";
  return "customer";
}

export function normalizePublisherStatus(value: unknown): PublisherStatus {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected") return s;
  return "none";
}

/** Nama yang ditampilkan untuk sebuah jenis akun. */
export function accountTypeLabel(type: AccountType): string {
  if (type === "company") return "Company";
  if (type === "agent") return "Agent";
  return "Customer";
}
