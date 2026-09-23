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
  it("default: staff tidak dapat apa-apa — owner yang memutuskan, bukan bawaan", () => {
    // "Kamu tidak diberi apa-apa sampai seseorang memutuskan" adalah arah yang
    // benar untuk akses yang didelegasikan. Tidak ada yang dirugikan: belum ada
    // satu pun akun staff waktu default ini ditulis.
    expect(DEFAULT_BUSINESS_ROLE_PERMISSIONS.staff).toEqual([]);
  });

  it("staff satu-satunya tingkat yang bisa diatur — owner selalu punya semuanya", () => {
    expect(Object.keys(DEFAULT_BUSINESS_ROLE_PERMISSIONS)).toEqual(["staff"]);
  });

  it("belum pernah diatur (null/bukan objek) → default", () => {
    for (const raw of [null, undefined, "{}", 7]) {
      expect(normalizeBusinessRolePermissions(raw)).toEqual(DEFAULT_BUSINESS_ROLE_PERMISSIONS);
    }
  });

  it("daftar kosong yang TERSIMPAN menang atas default", () => {
    // "Owner mencentang-lepas semuanya" adalah keputusan. Jatuh ke default di
    // sini akan membatalkannya diam-diam, dan layarnya akan terlihat benar.
    expect(normalizeBusinessRolePermissions({ staff: [] })).toEqual({ staff: [] });
  });

  it("peran 'admin' yang tersimpan dari model lama diabaikan, bukan dibawa ikut", () => {
    // JSON lama masih boleh ada di database; membuangnya di sini adalah cara
    // peran itu berhenti berarti apa-apa.
    expect(normalizeBusinessRolePermissions({ admin: ["users"], staff: ["hero"] })).toEqual({
      staff: ["hero"],
    });
  });

  it("kunci fitur yang tidak dikenal dibuang, bukan diteruskan", () => {
    expect(normalizeBusinessRolePermissions({ staff: ["hero", "nope", 3] })).toEqual({
      staff: ["hero"],
    });
  });
});

describe("matriks per-situs", () => {
  it("customer satu-satunya baris yang tersisa; publisher dibuang", () => {
    expect(DEFAULT_ROLE_PERMISSIONS).toEqual({ customer: [] });
    // Baris publisher yang masih tersimpan dari model lama tidak boleh
    // diam-diam tetap memberi fitur ke siapa pun.
    expect(normalizeRolePermissions({ customer: ["stats"], publisher: ["users"] })).toEqual({
      customer: ["stats"],
    });
  });
});
