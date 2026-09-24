"use server";

import { cache } from "react";
import { unstable_noStore, unstable_cache, revalidatePath } from "next/cache";
import { createAnonClient } from "@/lib/db/anon";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { setBusinessContext } from "@/lib/backend/tenant";
import { normalizeBusinessRole, type BusinessRole } from "@/lib/profile-utils";
import { ALL_FEATURE_KEYS, type FeatureKey } from "@/lib/features";
import {
  canManageSite,
  canSellOnSite,
  type SiteStanding,
} from "@/lib/site-membership";
import { canonicalSiteId, currentSiteId, editingSite } from "@/lib/site-resolve";
import { sniffBrandImage } from "@/lib/site-brand";
import { imageMaxBytes, imageMaxLabel } from "@/lib/upload-limit";
import {
  DEFAULT_BUSINESS_ROLE_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeBusinessRolePermissions,
  normalizeRolePermissions,
  type BusinessRolePermissions,
  type RolePermissions,
} from "@/lib/role-permissions";

export type Profile = {
  id: string;
  full_name: string | null;
  /**
   * When they proved they own the address, or null if they never have.
   * Not auth.users.email_confirmed_at — that only means "allowed to sign in"
   * now (see the 20260729 migration). Google signups arrive already verified.
   */
  email_verified_at: string | null;
  /** Public URL of their picture, or null — the initial letter is the fallback. */
  avatar_url: string | null;
  /** Platform operator — bypasses business scoping (docs/plans/multi-business-saas.md). */
  is_platform: boolean;
  /**
   * The business they belong to and their role in it, or null for an ordinary
   * buyer. Together with `is_platform` this replaces `account_type` (Fase 5).
   *
   * One membership, not a list: the application form allows exactly one, and
   * every screen that asks "which business is this person's" would otherwise
   * have to pick. The per-SITE answer is `SiteStanding.businessRole`, which is
   * the one permissions are decided from.
   */
  business_id: string | null;
  business_role: BusinessRole | null;
};

/**
 * Platform operator saja — aksi yang tidak boleh didelegasikan ke siapa pun:
 * buat/hapus situs, hapus akun, ban, ubah kedudukan orang lain.
 *
 * Dulu "Company saja" lewat `account_type`. Sejak Fase 5 kedudukan itu ada di
 * `lp_profiles.is_platform`, jadi ini dan `requirePlatform()` menanyakan hal yang
 * sama; dua nama dipertahankan karena dua puluhan pemanggil menyebut niat yang
 * berbeda ("ini aksi platform" vs "ini tampilan lintas business").
 */
export async function requireAdmin() {
  return !!(await getProfile())?.is_platform;
}

/** Platform operator saja (docs/plans/multi-business-saas.md) — lintas business. */
export async function requirePlatform() {
  return !!(await getProfile())?.is_platform;
}

/**
 * Boleh membuat & menjual produk **di mana pun**.
 *
 * Platform dan siapa pun yang tergabung di sebuah business — termasuk staff,
 * karena menjual memang pekerjaannya. `canSellOnCurrentSite(siteId)` versi
 * per-situsnya: ia menanyakan business PEMILIK situs itu, jadi anggota business
 * lain tidak ikut lolos di storefront orang.
 */
export async function canSellProducts() {
  const profile = await getProfile();
  return !!profile && (profile.is_platform || profile.business_role !== null);
}

/* -------------------------------------------------------------------------- *
 * Kedudukan di sebuah situs.
 *
 * Tiga fakta dari tiga tempat: lp_profiles.is_platform = operator platform,
 * lp_business_members = perannya di business PEMILIK situs ini, lp_site_members
 * = dia pembeli di sini. Sejak peran dipangkas jadi empat, lp_site_agents dan
 * is_publisher tidak ada lagi — keduanya menjawab pertanyaan yang sekarang
 * dijawab seluruhnya oleh peran business.
 * -------------------------------------------------------------------------- */

/**
 * `cache()` = memoisasi per-request, bukan cache lintas request: ini data satu
 * orang, tidak boleh masuk `unstable_cache` yang dibagi antar pengunjung. Layar
 * panel menanyakannya beberapa kali dalam satu render.
 *
 * `businessRole` di-resolve terhadap business PEMILIK SITUS INI, bukan terhadap
 * business si pemanggil: owner sebuah business tidak otomatis jadi apa-apa di
 * storefront milik orang lain. Itu perbedaan yang tidak bisa diungkapkan model
 * `account_type` lama, dan alasan Fase 5 ada.
 */
const readStanding = cache(
  async (userId: string, siteId: string, isPlatform: boolean): Promise<SiteStanding> => {
    const empty: SiteStanding = { isPlatform, businessRole: null, isMember: false };
    if (!userId || !siteId) return empty;
    const admin = createAdminClient();
    const [{ data: site }, { data: member }] = await Promise.all([
      admin.from("lp_sites").select("business_id").eq("id", siteId).maybeSingle(),
      admin.from("lp_site_members").select("user_id")
        .eq("user_id", userId).eq("site_id", siteId).maybeSingle(),
    ]);

    let businessRole: BusinessRole | null = null;
    const businessId = (site?.business_id as string | null) ?? null;
    if (businessId) {
      const { data: membership } = await admin
        .from("lp_business_members")
        .select("role")
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .maybeSingle();
      businessRole = normalizeBusinessRole(membership?.role);
    }

    return { isPlatform, businessRole, isMember: !!member };
  },
);

/**
 * Kedudukan orang yang sedang login di situs yang sedang dilihat panel.
 *
 * Situsnya boleh dikirim sebagai argumen. Kalau tidak, dipakai cakupan panel —
 * dan itu satu-satunya tempat cookie scope dibaca untuk keputusan izin, supaya
 * tidak ada layar yang diam-diam memutuskan dari cookie sendiri.
 */
export async function currentSiteStanding(siteId?: string): Promise<SiteStanding | null> {
  const profile = await getProfile();
  if (!profile) return null;
  const id = siteId ?? (await editingSite()).id;
  return readStanding(profile.id, id, profile.is_platform);
}

/** Boleh mengurus situs ini — kontennya, setelannya, customer-nya. */
export async function requireSiteAdmin(siteId?: string): Promise<boolean> {
  return canManageSite(await currentSiteStanding(siteId));
}

/** Boleh membuat & menjual produk DI SITUS INI. */
export async function canSellOnCurrentSite(siteId?: string): Promise<boolean> {
  return canSellOnSite(await currentSiteStanding(siteId));
}

/**
 * Catat orang ini sebagai customer situs ini, kalau belum.
 *
 * Idempoten: callback Duitku memang dikirim ulang, dan baris yang sudah ada
 * tidak boleh ditimpa — baris keanggotaan menyimpan siapa yang mengundang dan
 * kapan, dan itu tidak boleh hilang gara-gara dia membeli lagi. Karena itu
 * `ignoreDuplicates`, bukan upsert.
 *
 * Best-effort di semua pemanggilnya: keanggotaan yang gagal tercatat adalah satu
 * baris yang hilang, sementara melempar error di sini berarti signup gagal atau
 * callback pembayaran tidak dibalas 200 — dua kerugian yang jauh lebih besar.
 */
export async function ensureSiteMembership(userId: string, siteId: string): Promise<void> {
  if (!userId || !siteId) return;
  try {
    await createAdminClient()
      .from("lp_site_members")
      .upsert({ site_id: siteId, user_id: userId }, {
        onConflict: "site_id,user_id",
        ignoreDuplicates: true,
      });
  } catch (e) {
    console.error("ensureSiteMembership error:", e);
  }
}

/**
 * Peta role→fitur untuk SATU situs, dengan baris kanonik sebagai cadangan.
 *
 * Dulu sengaja tidak di-scope: panel hanya dilayani domain kanonik, jadi kuncinya
 * tepat satu baris. Dengan admin situs (fase 6) itu tidak cukup lagi — tiap situs
 * boleh punya peta sendiri. Situs yang belum pernah mengaturnya memakai peta
 * kanonik, jadi tidak ada domain yang tiba-tiba kehilangan delegasinya karena
 * barisnya belum dibuat.
 *
 * siteId dikirim sebagai ARGUMEN, tidak pernah dibaca dari cookie di dalam sini:
 * fungsi ter-cache tidak boleh menyentuh sumber dinamis, dan argumen itu juga
 * yang jadi cache key per-tenant (invarian I1).
 */
const readRolePermissions = unstable_cache(
  async (siteId: string, canonicalId: string): Promise<RolePermissions> => {
    try {
      const db = createAnonClient();
      const ids = [...new Set([siteId, canonicalId].filter(Boolean))];
      if (!ids.length) return DEFAULT_ROLE_PERMISSIONS;
      const { data } = await db
        .from("lp_site_settings")
        .select("site_id, value")
        .eq("key", "role_permissions")
        .in("site_id", ids);
      const rows = data ?? [];
      // Milik situs ini kalau ada; kalau tidak, milik kanonik.
      const row =
        rows.find((r) => r.site_id === siteId) ?? rows.find((r) => r.site_id === canonicalId);
      if (!row?.value) return DEFAULT_ROLE_PERMISSIONS;
      return normalizeRolePermissions(JSON.parse(row.value as string));
    } catch {
      return DEFAULT_ROLE_PERMISSIONS;
    }
  },
  ["role-permissions"],
  { revalidate: 120, tags: ["role-permissions"] },
);

/** Peta untuk situs yang sedang dilihat panel. */
export async function getRolePermissions(siteId?: string): Promise<RolePermissions> {
  const [site, canonicalId] = await Promise.all([
    siteId ? Promise.resolve({ id: siteId }) : editingSite(),
    canonicalSiteId(),
  ]);
  return readRolePermissions(site.id, canonicalId);
}

/**
 * Peta fitur per peran BUSINESS (Fase 5) — `{admin, staff}` untuk satu business.
 *
 * Tersimpan di kolom `lp_businesses.role_permissions`. Dibaca lewat service-role
 * karena `lp_businesses` service-role-only sejak Fase 0; gerbangnya ada di
 * pemanggil, yang hanya pernah menanyakan business yang memiliki situs yang
 * sedang dibuka orang itu.
 *
 * Tidak ter-`unstable_cache`: nilainya per-business dan berubah lewat satu layar
 * yang jarang dipakai, sementara cache lintas-request untuk data otorisasi adalah
 * cara yang rapi untuk memberi orang izin yang baru saja dicabut.
 */
const readBusinessRolePermissions = cache(
  async (businessId: string | null): Promise<BusinessRolePermissions> => {
    if (!businessId) return DEFAULT_BUSINESS_ROLE_PERMISSIONS;
    try {
      const { data } = await createAdminClient()
        .from("lp_businesses")
        .select("role_permissions")
        .eq("id", businessId)
        .maybeSingle();
      return normalizeBusinessRolePermissions(data?.role_permissions);
    } catch {
      return DEFAULT_BUSINESS_ROLE_PERMISSIONS;
    }
  },
);

/** Peta peran business untuk business yang memiliki situs yang sedang dibuka panel. */
export async function getBusinessRolePermissions(
  businessId?: string | null,
): Promise<BusinessRolePermissions> {
  const id = businessId === undefined ? (await editingSite()).business_id : businessId;
  return readBusinessRolePermissions(id ?? null);
}

/**
 * Fitur yang bisa dicapai orang ini di situs yang sedang dibuka — GABUNGAN dari
 * setiap jalan masuk yang dia punya, bukan yang pertama cocok.
 *
 * Tiga jalan, dan seseorang boleh punya lebih dari satu (staff di business ini
 * yang juga pembeli di sini). Mengambil yang pertama cocok berarti menambah
 * peran bisa MENGURANGI izin, yang tidak akan pernah ditebak siapa pun.
 *
 *   Platform                      semuanya
 *   owner business pemilik situs  semuanya (owner tidak bisa dikunci dari
 *                                 business-nya sendiri — lihat lib/role-permissions)
 *   staff business itu            dari matriks business
 *   sisanya                       dari matriks situs, baris customer
 */
async function accessibleFeatures(): Promise<FeatureKey[]> {
  const profile = await getProfile();
  if (!profile) return [];
  if (profile.is_platform) return [...ALL_FEATURE_KEYS];

  const standing = await currentSiteStanding();
  if (standing?.businessRole === "business") return [...ALL_FEATURE_KEYS];

  const granted = new Set<FeatureKey>();

  if (standing?.businessRole === "staff") {
    const site = await editingSite();
    const bizPerms = await getBusinessRolePermissions(site.business_id);
    for (const k of bizPerms.staff) granted.add(k);
  }

  const sitePerms = await getRolePermissions();
  for (const k of sitePerms.customer) granted.add(k);

  return [...granted];
}

/**
 * Access check for an admin feature. The Platform has everything; otherwise the
 * feature must be granted by one of the matrices — per business (/panel/roles,
 * kolom Staff) or per site (kolom Customer).
 */
export async function requireFeature(feature: FeatureKey): Promise<boolean> {
  return (await accessibleFeatures()).includes(feature);
}

/** Feature keys the current user can access — drives the nav. */
export async function getAccessibleFeatures(): Promise<FeatureKey[]> {
  return accessibleFeatures();
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  unstable_noStore();
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data, error } = await db
    .from("lp_profiles")
    .select("id, full_name, email_verified_at, avatar_url, is_platform")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  // Carry the platform flag into the request so the DB layer can let Platform
  // bypass business scoping (Fase 2 policies read is_platform()).
  setBusinessContext({ isPlatform: !!data.is_platform });

  // Their business membership — the half of the old account_type that says
  // "whose". Service-role because lp_business_members is service-role-only; the
  // gate is that it only ever reads the signed-in user's own row.
  const { data: membership } = await createAdminClient()
    .from("lp_business_members")
    .select("business_id, role")
    .eq("user_id", data.id)
    .limit(1);
  const mine = membership?.[0];

  return {
    id: data.id,
    full_name: data.full_name ?? null,
    email_verified_at: data.email_verified_at ?? null,
    avatar_url: data.avatar_url ?? null,
    is_platform: !!data.is_platform,
    business_id: (mine?.business_id as string | null) ?? null,
    business_role: normalizeBusinessRole(mine?.role),
  } as Profile;
});

/*
 * The publisher application used to live here: a customer uploaded a KTP photo
 * and a selfie, and an admin promoted them to "may sell on this storefront".
 *
 * Gone with the four-role rework. Somebody who wants to sell registers a
 * Business — which already has KYC, a ledger and payouts — and is then owner of
 * it, or is invited into one as staff. One road instead of two that had to be
 * kept agreeing with each other.
 */

export type ProfileWithUser = {
  id: string;
  full_name: string | null;
  /** Kedudukan platform-wide, diturunkan (Fase 5) — bukan lagi satu kolom. */
  is_platform: boolean;
  business_role: BusinessRole | null;
  email: string | null;
};

/** For profile page: profile + email from auth. Returns null if not logged in. */
export async function getProfileWithUser(): Promise<ProfileWithUser | null> {
  unstable_noStore();
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  let { data, error } = await db
    .from("lp_profiles")
    .select("id, full_name, is_platform")
    .eq("id", user.id)
    .single();

  if ((error || !data) && user) {
    // A signed-in user may insert only (id, full_name) — naming any other column
    // here is refused (20260919010000). That refusal is the point: this is the
    // path an account without a profile takes, and it must not be a way to hand
    // oneself a standing. Since Fase 5 there is no account_type to pick at all;
    // is_platform defaults to false and business membership is a separate table
    // nobody writes to from here.
    const { error: insertError } = await db.from("lp_profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? null,
    });
    if (!insertError || insertError.code === "23505") {
      const ret = await db
        .from("lp_profiles")
        .select("id, full_name, is_platform")
        .eq("id", user.id)
        .single();
      data = ret.data;
      error = ret.error;
    }
  }

  if (error || !data) return null;
  const { data: membership } = await createAdminClient()
    .from("lp_business_members")
    .select("role")
    .eq("user_id", data.id)
    .limit(1);
  return {
    id: data.id,
    full_name: data.full_name ?? null,
    is_platform: !!data.is_platform,
    business_role: normalizeBusinessRole(membership?.[0]?.role),
    // Status pengajuan hidup di keanggotaan sekarang, dan keanggotaan itu
    // per-situs — jadi yang dilaporkan adalah status di situs yang sedang dibuka.
    email: user.email ?? null,
  };
}

export async function updateProfile(formData: FormData) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const full_name = (formData.get("full_name") as string)?.trim() ?? "";
  const { error } = await db
    .from("lp_profiles")
    .update({ full_name: full_name || null })
    .eq("id", user.id);

  if (error) {
    console.error("updateProfile error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  return { ok: true };
}

/**
 * The image size cap that applies to the signed-in user, for the client-side
 * direct-to-Storage uploads that have no Server Action to check them.
 *
 * Server-authoritative: the browser asks rather than deciding, so the number
 * cannot be edited in devtools. The CHECK still runs in the browser, which makes
 * it a UI limit on that path — real enforcement for those uploads would need a
 * Storage policy, since the file never passes through our server.
 */
export async function imageUploadLimit(): Promise<{ bytes: number; label: string }> {
  const isAdmin = await requireAdmin();
  return { bytes: imageMaxBytes(isAdmin), label: imageMaxLabel(isAdmin) };
}

/** Everyone gets 512 KB — an avatar renders at 96px at most. */
const AVATAR_MAX_BYTES = 512 * 1024;

/**
 * Set the signed-in user's picture. Any role: a buyer, a staff member and the
 * all reach the same profile screen and all get the same control.
 *
 * Uses the service-role client, so the gate is explicit (I6): the path is built
 * from `user.id` read out of the session, never from anything the form sent, so
 * a request cannot write into someone else's prefix or point their row at a file.
 *
 * SVG is refused even though sniffBrandImage accepts it. Site branding is
 * uploaded by admins and an SVG there is a vector logo; an avatar is uploaded by
 * anyone with an account, and an SVG is a script that the storage domain would
 * serve as image/svg+xml. The other three formats cannot carry one.
 */
export async function uploadProfileAvatar(
  form: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "File tidak ditemukan." };
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Ukuran maksimal 512 KB — kompres dulu." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffBrandImage(bytes);
  if (!sniffed || sniffed.ext === "svg") {
    return { ok: false, error: "Format harus PNG, WebP, atau JPEG." };
  }

  const admin = createAdminClient();
  // Timestamped, like the branding uploads: replacing a picture leaves the old
  // object behind rather than racing a delete against a page still serving it.
  const path = `avatars/${user.id}/${Date.now()}.${sniffed.ext}`;
  const { error: upErr } = await admin.storage
    .from("landing-assets")
    // The sniffed type, never the declared one — this becomes the Content-Type
    // the public bucket serves it with.
    .upload(path, bytes, { contentType: sniffed.contentType, upsert: false });
  if (upErr) {
    console.error("uploadProfileAvatar upload error:", upErr);
    return { ok: false, error: "Gagal mengunggah." };
  }

  const { data } = admin.storage.from("landing-assets").getPublicUrl(path);
  const url = data.publicUrl;

  const { error } = await db
    .from("lp_profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (error) {
    console.error("uploadProfileAvatar save error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }

  revalidatePath("/panel");
  return { ok: true, url };
}

/** Clear the picture and fall back to the initial letter. */
export async function removeProfileAvatar(): Promise<{ ok: boolean; error?: string }> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const { error } = await db
    .from("lp_profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (error) {
    console.error("removeProfileAvatar error:", error);
    return { ok: false, error: "Gagal menghapus." };
  }

  revalidatePath("/panel");
  return { ok: true };
}
