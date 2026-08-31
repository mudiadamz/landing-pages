export type Role = "company" | "customer" | "publisher";

export type PublisherStatus = "none" | "pending" | "approved" | "rejected";

/**
 * Role platform: **Company**, publisher, atau Customer.
 *
 * `"admin"` masih diterima dan artinya Company. Itu nilai lama — sebagian baris
 * memakainya sampai migration `20260902010000` selesai memindahkannya, dan
 * penerimaannya sengaja TIDAK dicabut sesudah itu: kalau sebuah baris entah
 * bagaimana kembali berisi 'admin' (restore backup lama, sunting manual di
 * dashboard), yang benar adalah dia tetap Company — bukan diam-diam turun jadi
 * Customer, yang persis kebalikan dari maksudnya.
 */
export function normalizeRole(value: unknown): Role {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "company" || s === "admin") return "company";
  if (s === "publisher") return "publisher";
  return "customer";
}

export function normalizePublisherStatus(value: unknown): PublisherStatus {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected") return s;
  return "none";
}

/** Company dan publisher yang disetujui boleh membuat & menjual produk. */
export function canSell(role: Role): boolean {
  return role === "company" || role === "publisher";
}

/** Nama yang ditampilkan untuk sebuah role. */
export function roleLabel(role: Role): string {
  if (role === "company") return "Company";
  if (role === "publisher") return "Publisher";
  return "Customer";
}
