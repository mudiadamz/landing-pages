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
 * Empat fakta dari empat tempat, sengaja tidak diringkas jadi satu "role":
 * `lp_profiles.is_platform`, peran di business PEMILIK SITUS INI
 * (`lp_business_members`), keagenan (`lp_site_agents`), dan izin jual di baris
 * keanggotaan (`lp_site_members`). Meringkasnya jadi satu nilai adalah persis
 * yang membuat model sebelumnya menyimpan "publisher" di dua tempat.
 *
 * `businessRole` sengaja per-situs, bukan global: yang ditanyakan selalu "dia
 * pengelola business yang memiliki situs INI?", dan sejak business kedua ada,
 * jawabannya berbeda per situs (Fase 5).
 */
export type SiteStanding = {
  /** Operator platform — lolos di mana pun. Dulu `accountType === "company"`. */
  isPlatform: boolean;
  /** Perannya di business yang MEMILIKI situs ini, atau null. Dulu "Agent" global. */
  businessRole: BusinessRole | null;
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
 * Platform menang tanpa perlu terdaftar di mana pun: dia yang membuat situsnya,
 * dan mengunci dirinya di luar domain yang baru dibuat adalah cara bodoh untuk
 * kehilangan akses. Owner & admin business pemiliknya juga lolos — situs itu
 * memang milik business mereka; staff tidak (dia bekerja di dalamnya, bukan
 * mengaturnya).
 */
export function canManageSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.isPlatform || managesBusiness(s.businessRole) || s.isAgent;
}

/**
 * Boleh membuat & menjual produk di situs ini.
 *
 * Lebih longgar daripada mengurus: staff sebuah business ikut lolos — menjual
 * adalah pekerjaannya. Dan jalan terakhir adalah inti model lama yang tetap
 * berlaku: seorang Customer yang disetujui sebagai publisher **di situs itu**
 * boleh menjual di situ, tanpa jadi anggota business mana pun.
 */
export function canSellOnSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.isPlatform || s.businessRole !== null || s.isAgent || s.isPublisher;
}

/** Punya urusan apa pun dengan situs ini? Bukan siapa-siapa = tidak boleh apa-apa. */
export function belongsToSite(s: SiteStanding | null): boolean {
  if (!s) return false;
  return s.isPlatform || s.businessRole !== null || s.isAgent || s.isMember;
}
