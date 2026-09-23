import { managesBusiness, type BusinessRole } from "@/lib/profile-utils";

/**
 * Siapa boleh apa DI SEBUAH SITUS.
 *
 * Satu tempat yang menjawabnya, bukan pengecekan yang disalin ke tiap layar:
 * filter yang hilang menampilkan LEBIH banyak data daripada seharusnya, dan itu
 * terlihat seperti berhasil.
 *
 * Murni — tanpa impor server. Layar panel, route handler, dan unit test memakai
 * fungsi yang sama, dan hanya satu di antaranya punya request.
 */

/**
 * Kedudukan seseorang di satu situs, sesudah semua tabelnya dibaca.
 *
 * Tiga fakta sekarang, bukan lima: sejak peran disederhanakan jadi empat,
 * `isAgent` (lp_site_agents) dan `isPublisher` (lp_site_members.is_publisher)
 * sudah tidak ada. Keduanya menjawab "boleh jualan/mengurus di situs ini" —
 * pertanyaan yang sekarang dijawab seluruhnya oleh `businessRole`.
 *
 * `businessRole` sengaja per-situs, bukan global: yang ditanyakan selalu "dia
 * pengelola business yang memiliki situs INI?", dan sejak ada business kedua
 * jawabannya berbeda per situs.
 */
export type SiteStanding = {
  /** Operator platform — lolos di mana pun. */
  isPlatform: boolean;
  /** Perannya di business yang MEMILIKI situs ini, atau null. */
  businessRole: BusinessRole | null;
  /** Ada baris di `lp_site_members` untuk situs ini — dia pembeli di sini. */
  isMember: boolean;
};

/**
 * Boleh mengurus situs ini: kontennya, setelannya, customer-nya.
 *
 * Platform menang tanpa perlu terdaftar di mana pun: dia yang membuat situsnya,
 * dan mengunci dirinya di luar domain yang baru dibuat adalah cara bodoh untuk
 * kehilangan akses. Selain itu hanya **owner** business pemiliknya — staff
 * bekerja di dalam business, tidak mengaturnya.
 */
export function canManageSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.isPlatform || managesBusiness(s.businessRole);
}

/**
 * Boleh membuat & menjual produk di situs ini.
 *
 * Lebih longgar daripada mengurus: **staff ikut**, karena menjual memang
 * pekerjaannya. Di luar business pemilik situs tidak ada jalan lain — itu yang
 * dulu diisi "publisher", dan penggantinya adalah mendaftarkan business sendiri.
 */
export function canSellOnSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.isPlatform || s.businessRole !== null;
}

/** Punya urusan apa pun dengan situs ini? Bukan siapa-siapa = tidak boleh apa-apa. */
export function belongsToSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.isPlatform || s.businessRole !== null || s.isMember;
}
