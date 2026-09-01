import type { AccountType } from "@/lib/profile-utils";

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
 * Tiga fakta yang datang dari tiga tempat berbeda, sengaja tidak diringkas jadi
 * satu "role": jenis akun ada di profil, keagenan di `lp_site_agents`, dan izin
 * jual di baris keanggotaan. Meringkasnya jadi satu nilai adalah persis yang
 * membuat model sebelumnya menyimpan "publisher" di dua tempat.
 */
export type SiteStanding = {
  accountType: AccountType;
  /** Ada baris di `lp_site_agents` untuk situs ini. */
  isAgent: boolean;
  /** Ada baris di `lp_site_members` untuk situs ini. */
  isMember: boolean;
  /** `lp_site_members.is_publisher` — boleh menjual DI SITUS INI. */
  isPublisher: boolean;
};

/**
 * Boleh mengurus situs ini: kontennya, setelannya, dan customer-nya.
 *
 * Company menang tanpa perlu terdaftar sebagai Agent: dia yang membuat situsnya,
 * dan mengunci dirinya di luar domain yang baru dibuat adalah cara bodoh untuk
 * kehilangan akses.
 */
export function canManageSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.accountType === "company" || s.isAgent;
}

/**
 * Boleh membuat & menjual produk di situs ini.
 *
 * Tiga jalan masuk, dan yang ketiga adalah inti model baru: seorang Customer
 * yang disetujui sebagai publisher **di situs itu** boleh menjual di situ, tanpa
 * jadi Agent dan tanpa berubah jenis akun.
 */
export function canSellOnSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.accountType === "company" || s.isAgent || s.isPublisher;
}

/** Punya urusan apa pun dengan situs ini? Bukan siapa-siapa = tidak boleh apa-apa. */
export function belongsToSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.accountType === "company" || s.isAgent || s.isMember;
}
