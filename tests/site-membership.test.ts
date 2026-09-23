import { describe, it, expect } from "vitest";
import { belongsToSite, canManageSite, canSellOnSite, type SiteStanding } from "@/lib/site-membership";
import { managesBusiness, normalizeBusinessRole, standingLabel } from "@/lib/profile-utils";

/**
 * Aturan izin yang gagalnya senyap: kalau terlalu murah hati, layar tetap
 * merender dan justru menampilkan LEBIH banyak data — persis bentuk kegagalan
 * yang docs/architecture.md §6 bilang tidak akan kelihatan di layar.
 *
 * Empat kedudukan, tidak lebih: Platform · owner · staff · customer. "Publisher"
 * dan "Agent situs" sudah tidak ada — keduanya dulu menjawab "boleh jualan /
 * mengurus di situs ini", dan itu sekarang dijawab seluruhnya oleh peran di
 * business PEMILIK situs itu.
 */
const at = (o: Partial<SiteStanding> = {}): SiteStanding => ({
  isPlatform: false,
  businessRole: null,
  isMember: false,
  ...o,
});

describe("canManageSite", () => {
  it("Platform menang tanpa perlu terdaftar di mana pun", () => {
    // Dia yang membuat situsnya; mengunci dirinya di luar domain yang baru
    // dibuat adalah cara bodoh untuk kehilangan akses.
    expect(canManageSite(at({ isPlatform: true }))).toBe(true);
  });

  it("owner business pemilik situs boleh; staff TIDAK", () => {
    expect(canManageSite(at({ businessRole: "owner" }))).toBe(true);
    // Staff bekerja DI DALAM business, bukan mengaturnya. Kalau staff ikut
    // lolos di sini, "sub-akun" jadi sinonim "pemilik".
    expect(canManageSite(at({ businessRole: "staff" }))).toBe(false);
  });

  it("peran business TIDAK ikut ke storefront business lain", () => {
    // businessRole di-resolve terhadap pemilik situs ini, jadi seorang owner
    // yang membuka situs orang lain sampai ke sini sebagai null.
    expect(canManageSite(at({ businessRole: null }))).toBe(false);
  });

  it("pembeli dan bukan siapa-siapa tidak mengelola apa pun", () => {
    expect(canManageSite(at({ isMember: true }))).toBe(false);
    expect(canManageSite(null)).toBe(false);
  });
});

describe("canSellOnSite", () => {
  it("staff IKUT boleh menjual — lebih longgar daripada mengelola", () => {
    // Inti perbedaan kedua gate: menjual memang pekerjaan staff.
    expect(canSellOnSite(at({ businessRole: "staff" }))).toBe(true);
    expect(canManageSite(at({ businessRole: "staff" }))).toBe(false);
  });

  it("Platform dan owner selalu boleh", () => {
    expect(canSellOnSite(at({ isPlatform: true }))).toBe(true);
    expect(canSellOnSite(at({ businessRole: "owner" }))).toBe(true);
  });

  it("pembeli tidak, meski dia anggota situs", () => {
    // Ini yang dulu diisi "publisher": pembeli yang dinaikkan jadi penjual di
    // satu storefront. Sekarang tidak ada jalan itu — dia mendaftarkan business.
    expect(canSellOnSite(at({ isMember: true }))).toBe(false);
  });

  it("anggota business LAIN tidak boleh menjual di sini", () => {
    expect(canSellOnSite(at({ businessRole: null, isMember: true }))).toBe(false);
  });
});

describe("belongsToSite", () => {
  it("bukan siapa-siapa berarti tidak boleh apa-apa", () => {
    expect(belongsToSite(at())).toBe(false);
    expect(belongsToSite(null)).toBe(false);
  });

  it("pembeli, staff, owner, dan Platform punya urusan di sini", () => {
    expect(belongsToSite(at({ isMember: true }))).toBe(true);
    expect(belongsToSite(at({ businessRole: "staff" }))).toBe(true);
    expect(belongsToSite(at({ businessRole: "owner" }))).toBe(true);
    expect(belongsToSite(at({ isPlatform: true }))).toBe(true);
  });
});

describe("normalizeBusinessRole", () => {
  it("dua peran yang ada, case-insensitive", () => {
    expect(normalizeBusinessRole("OWNER")).toBe("owner");
    expect(normalizeBusinessRole(" staff ")).toBe("staff");
  });

  it("kosakata lama TURUN, tidak naik", () => {
    // Menggabungkan peran dengan menebak ke ATAS memberi orang izin yang tidak
    // pernah diputuskan siapa pun; menebak ke bawah paling banter bikin dia
    // minta dinaikkan.
    expect(normalizeBusinessRole("company")).toBe("owner");
    expect(normalizeBusinessRole("admin")).toBe("staff");
    expect(normalizeBusinessRole("agent")).toBe("staff");
  });

  it("nilai asing jatuh ke null — bukan ke peran paling rendah", () => {
    // null berarti "bukan anggota business ini", dan itu lebih sedikit izin
    // daripada 'staff'. Menebak 'staff' akan memberi akses ke baris yang rusak.
    expect(normalizeBusinessRole("publisher")).toBeNull();
    expect(normalizeBusinessRole(null)).toBeNull();
    expect(normalizeBusinessRole(7)).toBeNull();
  });
});

describe("managesBusiness & standingLabel", () => {
  it("owner mengelola; staff dan bukan-anggota tidak", () => {
    expect([
      managesBusiness("owner"),
      managesBusiness("staff"),
      managesBusiness(null),
    ]).toEqual([true, false, false]);
  });

  it("Platform menang atas peran business apa pun", () => {
    expect(standingLabel({ isPlatform: true, businessRole: "staff" })).toBe("Platform");
    expect(standingLabel({ isPlatform: false, businessRole: "owner" })).toBe("Owner");
    expect(standingLabel({ isPlatform: false, businessRole: "staff" })).toBe("Staff");
    expect(standingLabel({ isPlatform: false, businessRole: null })).toBe("Customer");
  });

  it("empat label, tidak lebih", () => {
    const labels = new Set(
      [
        { isPlatform: true, businessRole: null },
        { isPlatform: false, businessRole: "owner" as const },
        { isPlatform: false, businessRole: "staff" as const },
        { isPlatform: false, businessRole: null },
      ].map(standingLabel),
    );
    expect([...labels].sort()).toEqual(["Customer", "Owner", "Platform", "Staff"]);
  });
});
