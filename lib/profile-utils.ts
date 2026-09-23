/**
 * Siapa seseorang, platform-wide — penerus `lp_profiles.account_type`
 * (docs/plans/multi-business-saas.md, Fase 5).
 *
 * Jenis akun global sudah pensiun. Yang menggantikannya dua fakta yang tersimpan
 * di tempat yang benar:
 *
 *   Platform      `lp_profiles.is_platform` — operator SaaS-nya. Dulu "Company".
 *   Business role `lp_business_members.role` — owner | admin | staff, PER
 *                 business. Dulu "Agent", yang sebetulnya selalu berarti
 *                 "mengelola punya siapa", cuma tidak punya tempat menyimpan
 *                 "punya siapa"-nya.
 *   (tidak dua-duanya) pembeli biasa. Dulu "Customer".
 *
 * Alasan pindahnya: satu jenis akun global tidak bisa menjawab pertanyaan yang
 * sebenarnya ditanyakan setiap layar — "boleh apa dia DI SINI". Selama izinnya
 * global, menambah business kedua berarti setiap Agent jadi Agent di semua
 * business sekaligus.
 *
 * "Publisher" tetap bukan jenis akun: itu flag pada keanggotaan situs
 * (`lp_site_members.is_publisher`), seperti sebelumnya.
 */

export type BusinessRole = "owner" | "admin" | "staff";

export type PublisherStatus = "none" | "pending" | "approved" | "rejected";

/** Kedudukan platform-wide seseorang. Dua fakta, bukan satu nilai yang diringkas. */
export type Standing = {
  /** Operator platform (`lp_profiles.is_platform`) — lintas business. */
  isPlatform: boolean;
  /** Perannya di business yang dia ikuti, atau null kalau dia pembeli biasa. */
  businessRole: BusinessRole | null;
};

const ROLES = new Set<string>(["owner", "admin", "staff"]);

/**
 * Peran business yang dikenali, atau null.
 *
 * Nilai lama ikut dibaca supaya baris yang belum sempat dimigrasi tidak
 * diam-diam kehilangan tingkatannya: `company` → owner, `agent` → admin. Itu
 * pemetaan yang sama dengan yang dipakai backfill Fase 0/5.
 */
export function normalizeBusinessRole(value: unknown): BusinessRole | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (ROLES.has(s)) return s as BusinessRole;
  if (s === "company") return "owner";
  if (s === "agent") return "admin";
  return null;
}

export function normalizePublisherStatus(value: unknown): PublisherStatus {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected") return s;
  return "none";
}

/** Boleh mengurus business-nya: owner & admin. Staff bekerja di dalamnya, tidak mengaturnya. */
export function managesBusiness(role: BusinessRole | null): boolean {
  return role === "owner" || role === "admin";
}

/** Nama yang ditampilkan untuk sebuah kedudukan. */
export function standingLabel(s: Standing): string {
  if (s.isPlatform) return "Platform";
  if (s.businessRole === "owner") return "Owner";
  if (s.businessRole === "admin") return "Admin";
  if (s.businessRole === "staff") return "Staff";
  return "Customer";
}
