import { describe, it, expect } from "vitest";
import { belongsToSite, canManageSite, canSellOnSite, type SiteStanding } from "@/lib/site-membership";
import { normalizeAccountType } from "@/lib/profile-utils";

/**
 * Aturan izin yang gagalnya senyap: kalau terlalu murah hati, layar tetap
 * merender dan justru menampilkan LEBIH banyak data — persis bentuk kegagalan
 * yang docs/architecture.md §6 bilang tidak akan kelihatan di layar.
 */
const at = (o: Partial<SiteStanding> = {}): SiteStanding => ({
  accountType: "customer",
  isAgent: false,
  isMember: false,
  isPublisher: false,
  ...o,
});

describe("canManageSite", () => {
  it("Company menang tanpa perlu terdaftar sebagai Agent", () => {
    // Dia yang membuat situsnya; mengunci dirinya di luar domain yang baru
    // dibuat adalah cara bodoh untuk kehilangan akses.
    expect(canManageSite(at({ accountType: "company" }))).toBe(true);
  });

  it("Agent hanya di situs tempat dia terdaftar", () => {
    expect(canManageSite(at({ accountType: "agent", isAgent: true }))).toBe(true);
    // Jenis akun Agent saja tidak cukup — dia harus Agent DI SINI.
    expect(canManageSite(at({ accountType: "agent" }))).toBe(false);
  });

  it("customer, publisher, dan bukan siapa-siapa tidak mengelola apa pun", () => {
    expect(canManageSite(at({ isMember: true }))).toBe(false);
    expect(canManageSite(at({ isMember: true, isPublisher: true }))).toBe(false);
    expect(canManageSite(null)).toBe(false);
  });
});

describe("canSellOnSite", () => {
  it("publisher boleh menjual di situs tempat izinnya berlaku", () => {
    // Inti model ini: customer yang disetujui boleh berjualan tanpa jadi Agent
    // dan tanpa berubah jenis akun.
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

  it("Company dan Agent selalu boleh", () => {
    expect(canSellOnSite(at({ accountType: "company" }))).toBe(true);
    expect(canSellOnSite(at({ accountType: "agent", isAgent: true }))).toBe(true);
  });
});

describe("belongsToSite", () => {
  it("bukan siapa-siapa berarti tidak boleh apa-apa", () => {
    expect(belongsToSite(at())).toBe(false);
    expect(belongsToSite(null)).toBe(false);
  });

  it("customer, Agent, dan Company punya urusan di sini", () => {
    expect(belongsToSite(at({ isMember: true }))).toBe(true);
    expect(belongsToSite(at({ isAgent: true }))).toBe(true);
    expect(belongsToSite(at({ accountType: "company" }))).toBe(true);
  });
});

describe("normalizeAccountType", () => {
  it("membaca ketiga jenis akun, case-insensitive", () => {
    expect(normalizeAccountType("COMPANY")).toBe("company");
    expect(normalizeAccountType(" agent ")).toBe("agent");
    expect(normalizeAccountType("customer")).toBe("customer");
  });

  it("nilai lama tetap terbaca sebagai tingkatannya", () => {
    // 'admin' pernah berarti Company. Baris yang kembali berisi nilai lama harus
    // tetap Company, bukan diam-diam turun jadi Customer.
    expect(normalizeAccountType("admin")).toBe("company");
  });

  it("publisher BUKAN jenis akun lagi — dia customer dengan flag per situs", () => {
    expect(normalizeAccountType("publisher")).toBe("customer");
  });

  it("nilai asing jatuh ke jenis paling tidak berwenang", () => {
    expect(normalizeAccountType("owner")).toBe("customer");
    expect(normalizeAccountType(null)).toBe("customer");
    expect(normalizeAccountType(7)).toBe("customer");
  });
});
