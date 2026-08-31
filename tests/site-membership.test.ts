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
  it("platform admin menang, tanpa perlu jadi anggota", () => {
    // Dia yang membuat situsnya; mengunci dirinya di luar domain yang baru
    // dibuat adalah cara bodoh untuk kehilangan akses.
    expect(effectiveRole("admin", null)).toBe("admin");
    expect(effectiveRole("admin", "customer")).toBe("admin");
  });

  it("bukan anggota berarti null, bukan 'anggap saja pembeli'", () => {
    expect(effectiveRole("customer", null)).toBeNull();
    expect(effectiveRole("publisher", null)).toBeNull();
    expect(effectiveRole(undefined, null)).toBeNull();
  });

  it("selain platform admin, keanggotaan yang menentukan", () => {
    expect(effectiveRole("customer", "admin")).toBe("admin");
    expect(effectiveRole("publisher", "customer")).toBe("customer");
    // Publisher platform yang bukan anggota situs ini tidak membawa apa pun.
    expect(effectiveRole("publisher", null)).toBeNull();
  });
});

describe("kemampuan turunan", () => {
  it("hanya admin situs yang mengurus situs", () => {
    expect(canManageSite("admin")).toBe(true);
    expect(canManageSite("publisher")).toBe(false);
    expect(canManageSite("customer")).toBe(false);
    expect(canManageSite(null)).toBe(false);
  });

  it("admin dan publisher boleh menjual, pembeli tidak", () => {
    expect(canSellOnSite("admin")).toBe(true);
    expect(canSellOnSite("publisher")).toBe(true);
    expect(canSellOnSite("customer")).toBe(false);
    expect(canSellOnSite(null)).toBe(false);
  });

  it("hanya admin situs yang boleh memberi role, dan tidak melampaui dirinya", () => {
    expect(canAssignRole("admin", "publisher")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(true);
    expect(canAssignRole("publisher", "customer")).toBe(false);
    expect(canAssignRole("customer", "customer")).toBe(false);
    expect(canAssignRole(null, "customer")).toBe(false);
    // Tidak ada jalan dari sini menuju platform admin: itu hanya ada di
    // lp_profiles.role dan hanya platform admin yang menyentuhnya.
    // @ts-expect-error "owner" bukan SiteRole
    expect(canAssignRole("admin", "owner")).toBe(false);
  });
});

describe("normalizeSiteRole", () => {
  it("membaca yang tersimpan apa adanya, case-insensitive", () => {
    expect(normalizeSiteRole("ADMIN")).toBe("admin");
    expect(normalizeSiteRole(" publisher ")).toBe("publisher");
  });

  it("nilai asing jatuh ke role paling tidak berwenang", () => {
    expect(normalizeSiteRole("owner")).toBe("customer");
    expect(normalizeSiteRole(null)).toBe("customer");
    expect(normalizeSiteRole(7)).toBe("customer");
  });
});
