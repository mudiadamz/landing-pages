/**
 * Siapa seseorang, platform-wide.
 *
 * EMPAT kedudukan, tidak lebih (permintaan Adam, 2026-09-23):
 *
 *   Platform        operator SaaS-nya        `lp_profiles.is_platform`
 *   Business owner  pemilik sebuah business  `lp_business_members.role = 'owner'`
 *   Staff           sub-akun business itu    `lp_business_members.role = 'staff'`
 *   Customer        pembeli — bukan keduanya
 *
 * Yang dihapus, dan kenapa:
 *
 * - **`account_type` global** (company/agent/customer) sudah pensiun lebih dulu
 *   di Fase 5: satu nilai global tidak bisa menjawab pertanyaan yang sebenarnya
 *   ditanyakan tiap layar — "boleh apa dia DI SINI". Begitu ada business kedua,
 *   setiap "Agent" jadi Agent di semua business sekaligus.
 * - **Publisher** (`lp_site_members.is_publisher` + berkas KYC-nya) dan **Agent
 *   situs** (`lp_site_agents`). Keduanya menjawab hal yang sama — "orang ini
 *   boleh jualan / mengurus di situs ini" — lewat tabel masing-masing. Sejak ada
 *   pendaftaran Business (Fase 4) pertanyaan itu sudah punya satu jawaban:
 *   daftarkan business-nya, lalu ajak orangnya sebagai staff. Tiga jalan yang
 *   harus dijaga tetap sepakat adalah tiga tempat untuk tidak sepakat.
 * - **Peran business `admin`.** Dua tingkat pengelola di atas `staff` tidak
 *   pernah dipakai; yang tersisa `owner` (mengatur) dan `staff` (bekerja).
 *
 * Konsekuensinya sengaja: perorangan tidak lagi "dinaikkan jadi penjual" di satu
 * storefront. Dia mendaftarkan Business — yang memang sudah punya alur KYC,
 * ledger, dan payout sendiri.
 */

export type BusinessRole = "owner" | "staff";

/** Kedudukan platform-wide seseorang. Dua fakta, bukan satu nilai yang diringkas. */
export type Standing = {
  /** Operator platform (`lp_profiles.is_platform`) — lintas business. */
  isPlatform: boolean;
  /** Perannya di business yang dia ikuti, atau null kalau dia pembeli biasa. */
  businessRole: BusinessRole | null;
};

const ROLES = new Set<string>(["owner", "staff"]);

/**
 * Peran business yang dikenali, atau null.
 *
 * Nilai lama ikut dibaca supaya baris yang belum sempat dimigrasi tidak jatuh
 * jadi bukan-siapa-siapa: `company` → owner, dan `agent`/`admin` → **staff**.
 *
 * Yang lama diturunkan, bukan dinaikkan. Saat dua peran digabung jadi satu,
 * menebak ke atas memberi orang izin yang tidak pernah diputuskan siapa pun;
 * menebak ke bawah paling banter bikin dia minta dinaikkan. (Praktis nol baris
 * kena: waktu peran ini disederhanakan tidak ada satu pun `admin` di database.)
 */
export function normalizeBusinessRole(value: unknown): BusinessRole | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (ROLES.has(s)) return s as BusinessRole;
  if (s === "company") return "owner";
  if (s === "agent" || s === "admin") return "staff";
  return null;
}

/** Boleh mengurus business-nya: owner saja. Staff bekerja di dalamnya, tidak mengaturnya. */
export function managesBusiness(role: BusinessRole | null): boolean {
  return role === "owner";
}

/** Nama yang ditampilkan untuk sebuah kedudukan. */
export function standingLabel(s: Standing): string {
  if (s.isPlatform) return "Platform";
  if (s.businessRole === "owner") return "Owner";
  if (s.businessRole === "staff") return "Staff";
  return "Customer";
}
