import { describe, it, expect } from "vitest";
import {
  canAssignRole,
  canManageSite,
  canSellOnSite,
  effectiveRole,
  normalizeSiteRole,
} from "@/lib/site-membership";

/**
 * Aturan izin yang gagalnya senyap: kalau `effectiveRole` terlalu murah hati,
 * layar tetap merender dan justru menampilkan LEBIH banyak data — persis bentuk
 * kegagalan yang docs/architecture.md §6 bilang tidak akan kelihatan di layar.
 */
describe("effectiveRole", () => {
  it("Company menang, tanpa perlu jadi anggota", () => {
    // Dia yang membuat situsnya; mengunci dirinya di luar domain yang baru
    // dibuat adalah cara bodoh untuk kehilangan akses.
    expect(effectiveRole("company", null)).toBe("agent");
    expect(effectiveRole("company", "customer")).toBe("agent");
  });

  it("bukan anggota berarti null, bukan 'anggap saja pembeli'", () => {
    expect(effectiveRole("customer", null)).toBeNull();
    expect(effectiveRole("publisher", null)).toBeNull();
    expect(effectiveRole(undefined, null)).toBeNull();
  });

  it("selain Company, keanggotaan yang menentukan", () => {
    expect(effectiveRole("customer", "agent")).toBe("agent");
    expect(effectiveRole("publisher", "customer")).toBe("customer");
    // Publisher platform yang bukan anggota situs ini tidak membawa apa pun.
    expect(effectiveRole("publisher", null)).toBeNull();
  });
});

describe("kemampuan turunan", () => {
  it("hanya Agent yang mengurus situs", () => {
    expect(canManageSite("agent")).toBe(true);
    expect(canManageSite("publisher")).toBe(false);
    expect(canManageSite("customer")).toBe(false);
    expect(canManageSite(null)).toBe(false);
  });

  it("Agent dan publisher boleh menjual, Customer tidak", () => {
    expect(canSellOnSite("agent")).toBe(true);
    expect(canSellOnSite("publisher")).toBe(true);
    expect(canSellOnSite("customer")).toBe(false);
    expect(canSellOnSite(null)).toBe(false);
  });

  it("hanya Agent yang boleh memberi role, dan tidak melampaui dirinya", () => {
    expect(canAssignRole("agent", "publisher")).toBe(true);
    expect(canAssignRole("agent", "agent")).toBe(true);
    expect(canAssignRole("publisher", "customer")).toBe(false);
    expect(canAssignRole("customer", "customer")).toBe(false);
    expect(canAssignRole(null, "customer")).toBe(false);
    // Tidak ada jalan dari sini menuju Company: itu hanya ada di
    // lp_profiles.role dan hanya Company yang menyentuhnya.
    // @ts-expect-error "company" bukan SiteRole
    expect(canAssignRole("agent", "company")).toBe(false);
  });
});

describe("normalizeSiteRole", () => {
  it("membaca yang tersimpan apa adanya, case-insensitive", () => {
    expect(normalizeSiteRole("AGENT")).toBe("agent");
    expect(normalizeSiteRole(" publisher ")).toBe("publisher");
  });

  it("nilai asing jatuh ke role paling tidak berwenang", () => {
    // Nilai lama: 'admin' berarti Agent, bukan turun jadi Customer.
    expect(normalizeSiteRole("admin")).toBe("agent");
    expect(normalizeSiteRole("owner")).toBe("customer");
    expect(normalizeSiteRole(null)).toBe("customer");
    expect(normalizeSiteRole(7)).toBe("customer");
  });
});
