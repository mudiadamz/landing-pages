import { describe, expect, it } from "vitest";
import { ALL_FEATURE_KEYS } from "@/lib/features";
import {
  DEFAULT_BUSINESS_ROLE_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeBusinessRolePermissions,
  normalizeRolePermissions,
} from "@/lib/role-permissions";

/**
 * Two matrices on two axes (docs/plans/multi-business-saas.md, Fase 5).
 *
 * The interesting behaviour is not the normalising — it is the DEFAULT, which
 * decides what someone can reach the moment the phase ships, before anybody has
 * opened the screen. Get it wrong in one direction and every Agent-turned-admin
 * silently loses menus they had yesterday; in the other, a brand-new role is
 * born holding the keys.
 */

describe("matriks per-business", () => {
  it("default: admin dapat semuanya — persis yang dipunya Agent sebelum Fase 5", () => {
    // Setiap Agent lama jadi business admin lewat backfill. Default yang lebih
    // ketat = mengambil menu dari orang yang kemarin punya, tanpa ada yang
    // memutuskan itu.
    expect([...DEFAULT_BUSINESS_ROLE_PERMISSIONS.admin].sort()).toEqual([...ALL_FEATURE_KEYS].sort());
  });

  it("default: staff tidak dapat apa-apa — perannya baru, tidak ada yang dirugikan", () => {
    expect(DEFAULT_BUSINESS_ROLE_PERMISSIONS.staff).toEqual([]);
  });

  it("belum pernah diatur (null/bukan objek) → default", () => {
    for (const raw of [null, undefined, "{}", 7]) {
      expect(normalizeBusinessRolePermissions(raw)).toEqual(DEFAULT_BUSINESS_ROLE_PERMISSIONS);
    }
  });

  it("daftar kosong yang TERSIMPAN menang atas default", () => {
    // "Owner mencentang-lepas semuanya" adalah keputusan. Jatuh ke default di
    // sini akan membatalkannya diam-diam, dan layarnya akan terlihat benar.
    expect(normalizeBusinessRolePermissions({ admin: [], staff: [] })).toEqual({
      admin: [],
      staff: [],
    });
  });

  it("satu peran tersimpan, satu belum → yang belum pakai default", () => {
    expect(normalizeBusinessRolePermissions({ admin: ["users"] })).toEqual({
      admin: ["users"],
      staff: DEFAULT_BUSINESS_ROLE_PERMISSIONS.staff,
    });
  });

  it("kunci fitur yang tidak dikenal dibuang, bukan diteruskan", () => {
    expect(normalizeBusinessRolePermissions({ admin: ["users", "nope", 3], staff: ["hero"] })).toEqual({
      admin: ["users"],
      staff: ["hero"],
    });
  });
});

describe("matriks per-situs tidak ikut berubah", () => {
  it("default customer & publisher tetap kosong", () => {
    expect(DEFAULT_ROLE_PERMISSIONS).toEqual({ customer: [], publisher: [] });
    expect(normalizeRolePermissions({ publisher: ["stats", "salah"] })).toEqual({
      customer: [],
      publisher: ["stats"],
    });
  });
});
