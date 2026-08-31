import type { Role } from "@/lib/profile-utils";

/**
 * Siapa boleh apa DI SEBUAH SITUS.
 *
 * Fase 2 dari docs/plans/hierarchical-users.md. Satu tempat yang menjawabnya,
 * bukan pengecekan yang disalin ke tiap layar: filter yang hilang menampilkan
 * LEBIH banyak data daripada seharusnya, dan itu terlihat seperti berhasil.
 *
 * Murni — tanpa impor server sama sekali. Layar panel (server), route handler,
 * dan unit test memakai fungsi yang sama, dan hanya satu di antaranya punya
 * request.
 */

/** Role di dalam satu situs. Sengaja senama dengan role platform, beda arti. */
export type SiteRole = "admin" | "publisher" | "customer";

const SITE_ROLES: SiteRole[] = ["admin", "publisher", "customer"];

export function normalizeSiteRole(value: unknown): SiteRole {
  const s = String(value ?? "").trim().toLowerCase();
  return (SITE_ROLES as string[]).includes(s) ? (s as SiteRole) : "customer";
}

/**
 * Role yang berlaku untuk orang ini di situs ini, atau **null kalau dia bukan
 * anggota** — dan null berarti tidak boleh apa-apa, bukan "anggap saja pembeli".
 *
 * Platform admin menang atas segalanya dan tidak perlu jadi anggota: dia yang
 * membuat situsnya, dan mengunci dirinya sendiri di luar domain yang baru
 * dibuat adalah cara yang bodoh untuk kehilangan akses.
 */
export function effectiveRole(
  platformRole: Role | null | undefined,
  membership: SiteRole | null | undefined,
): SiteRole | null {
  if (platformRole === "admin") return "admin";
  return membership ?? null;
}

/** Boleh mengurus situs ini: kontennya, setelannya, dan anggotanya. */
export function canManageSite(effective: SiteRole | null): boolean {
  return effective === "admin";
}

/** Boleh membuat & menjual produk di situs ini. */
export function canSellOnSite(effective: SiteRole | null): boolean {
  return effective === "admin" || effective === "publisher";
}

/**
 * Boleh menetapkan role ini kepada orang lain?
 *
 * Admin situs tidak boleh mengangkat siapa pun melampaui dirinya sendiri, dan
 * tidak ada jalan dari sini menuju platform admin — itu hanya ada di
 * `lp_profiles.role` dan hanya platform admin yang menyentuhnya.
 */
export function canAssignRole(actor: SiteRole | null, target: SiteRole): boolean {
  if (actor !== "admin") return false;
  return (SITE_ROLES as string[]).includes(target);
}
