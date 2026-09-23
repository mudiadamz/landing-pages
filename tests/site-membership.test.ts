import { describe, it, expect } from "vitest";
import { belongsToSite, canManageSite, canSellOnSite, type SiteStanding } from "@/lib/site-membership";
import { managesBusiness, normalizeBusinessRole, standingLabel } from "@/lib/profile-utils";

/**
 * Aturan izin yang gagalnya senyap: kalau terlalu murah hati, layar tetap
 * merender dan justru menampilkan LEBIH banyak data — persis bentuk kegagalan
 * yang docs/architecture.md §6 bilang tidak akan kelihatan di layar.
 *
 * Sejak Fase 5 kedudukan bukan lagi satu `account_type` global: Platform ada di
 * `is_platform`, dan peran business selalu dibaca terhadap business PEMILIK SITUS
 * INI. Perbedaan itu yang paling layak diuji di sini — owner sebuah business
 * bukan siapa-siapa di storefront orang lain.
 */
const at = (o: Partial<SiteStanding> = {}): SiteStanding => ({
  isPlatform: false,
  businessRole: null,
  isAgent: false,
  isMember: false,
  isPublisher: false,
  ...o,
});

describe("canManageSite", () => {
  it("Platform menang tanpa perlu terdaftar di mana pun", () => {
    // Dia yang membuat situsnya; mengunci dirinya di luar domain yang baru
    // dibuat adalah cara bodoh untuk kehilangan akses.
    expect(canManageSite(at({ isPlatform: true }))).toBe(true);
  });

  it("owner & admin business pemilik situs boleh; staff tidak", () => {
    expect(canManageSite(at({ businessRole: "owner" }))).toBe(true);
    expect(canManageSite(at({ businessRole: "admin" }))).toBe(true);
    // Staff bekerja DI DALAM business, bukan mengaturnya.
    expect(canManageSite(at({ businessRole: "staff" }))).toBe(false);
  });

  it("peran business TIDAK ikut ke storefront business lain", () => {
    // Inti Fase 5: businessRole di-resolve terhadap pemilik situs ini, jadi
    // seorang owner yang membuka situs orang lain sampai ke sini sebagai null.
    expect(canManageSite(at({ businessRole: null }))).toBe(false);
  });

  it("Agent hanya di situs tempat dia terdaftar", () => {
    expect(canManageSite(at({ isAgent: true }))).toBe(true);
  });

  it("customer, publisher, dan bukan siapa-siapa tidak mengelola apa pun", () => {
    expect(canManageSite(at({ isMember: true }))).toBe(false);
    expect(canManageSite(at({ isMember: true, isPublisher: true }))).toBe(false);
    expect(canManageSite(null)).toBe(false);
  });
});

describe("canSellOnSite", () => {
  it("publisher boleh menjual di situs tempat izinnya berlaku", () => {
    // Model lama yang tetap berlaku: customer yang disetujui boleh berjualan
    // tanpa jadi anggota business mana pun.
    expect(canSellOnSite(at({ isMember: true, isPublisher: true }))).toBe(true);
  });

  it("customer biasa tidak, meski dia anggota", () => {
    expect(canSellOnSite(at({ isMember: true }))).toBe(false);
  });

  it("izin jual tidak ikut ke situs lain", () => {
    // Publisher di situs A membuka halaman situs B: barisnya di situs B tidak
    // punya flag itu, jadi standing-nya polos.
    expect(canSellOnSite(at({ isMember: true, isPublisher: false }))).toBe(false);
  });

  it("staff IKUT boleh menjual — lebih longgar daripada mengelola", () => {
    expect(canSellOnSite(at({ businessRole: "staff" }))).toBe(true);
    expect(canManageSite(at({ businessRole: "staff" }))).toBe(false);
  });

  it("Platform, owner/admin, dan Agent selalu boleh", () => {
    expect(canSellOnSite(at({ isPlatform: true }))).toBe(true);
    expect(canSellOnSite(at({ businessRole: "owner" }))).toBe(true);
    expect(canSellOnSite(at({ businessRole: "admin" }))).toBe(true);
    expect(canSellOnSite(at({ isAgent: true }))).toBe(true);
  });
});

describe("belongsToSite", () => {
  it("bukan siapa-siapa berarti tidak boleh apa-apa", () => {
    expect(belongsToSite(at())).toBe(false);
    expect(belongsToSite(null)).toBe(false);
  });

  it("customer, Agent, anggota business, dan Platform punya urusan di sini", () => {
    expect(belongsToSite(at({ isMember: true }))).toBe(true);
    expect(belongsToSite(at({ isAgent: true }))).toBe(true);
    expect(belongsToSite(at({ businessRole: "staff" }))).toBe(true);
    expect(belongsToSite(at({ isPlatform: true }))).toBe(true);
  });
});

describe("normalizeBusinessRole", () => {
  it("membaca ketiga peran, case-insensitive", () => {
    expect(normalizeBusinessRole("OWNER")).toBe("owner");
    expect(normalizeBusinessRole(" admin ")).toBe("admin");
    expect(normalizeBusinessRole("staff")).toBe("staff");
  });

  it("kosakata lama tetap terbaca sebagai tingkatannya", () => {
    // Pemetaan yang sama dengan backfill migration: baris yang entah bagaimana
    // masih berisi nilai lama tidak boleh diam-diam turun jadi bukan-siapa-siapa.
    expect(normalizeBusinessRole("company")).toBe("owner");
    expect(normalizeBusinessRole("agent")).toBe("admin");
  });

  it("nilai asing jatuh ke null — bukan ke peran paling rendah", () => {
    // null berarti "bukan anggota business ini", dan itu lebih sedikit izin
    // daripada 'staff'. Menebak 'staff' di sini akan memberi akses ke orang
    // yang barisnya rusak.
    expect(normalizeBusinessRole("publisher")).toBeNull();
    expect(normalizeBusinessRole(null)).toBeNull();
    expect(normalizeBusinessRole(7)).toBeNull();
  });
});

describe("managesBusiness & standingLabel", () => {
  it("owner & admin mengelola; staff dan bukan-anggota tidak", () => {
    expect([
      managesBusiness("owner"),
      managesBusiness("admin"),
      managesBusiness("staff"),
      managesBusiness(null),
    ]).toEqual([true, true, false, false]);
  });

  it("Platform menang atas peran business apa pun", () => {
    expect(standingLabel({ isPlatform: true, businessRole: "staff" })).toBe("Platform");
    expect(standingLabel({ isPlatform: false, businessRole: "owner" })).toBe("Owner");
    expect(standingLabel({ isPlatform: false, businessRole: null })).toBe("Customer");
  });
});
