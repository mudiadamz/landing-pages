"use server";

import { cache } from "react";
import { unstable_noStore, unstable_cache, revalidatePath } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeRole,
  normalizePublisherStatus,
  canSell,
  type Role,
  type PublisherStatus,
} from "@/lib/profile-utils";
import { ALL_FEATURE_KEYS, type FeatureKey } from "@/lib/features";
import {
  canManageSite,
  canSellOnSite,
  effectiveRole,
  normalizeSiteRole,
  type SiteRole,
} from "@/lib/site-membership";
import { canonicalSiteId, editingSite } from "@/lib/site-resolve";
import { sniffBrandImage } from "@/lib/site-brand";
import { imageMaxBytes, imageMaxLabel } from "@/lib/upload-limit";
import {
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissions,
  type RolePermissions,
} from "@/lib/role-permissions";

export type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  publisher_status: PublisherStatus;
  /**
   * When they proved they own the address, or null if they never have.
   * Not auth.users.email_confirmed_at — that only means "allowed to sign in"
   * now (see the 20260729 migration). Google signups arrive already verified.
   */
  email_verified_at: string | null;
  /** Public URL of their picture, or null — the initial letter is the fallback. */
  avatar_url: string | null;
};

/** Only users with profile.role === "company" are admin. No fallback for missing profile. */
export async function requireAdmin() {
  const profile = await getProfile();
  return profile?.role === "company";
}

/** Admin or approved publisher — may create & sell products. */
export async function canSellProducts() {
  const profile = await getProfile();
  return !!profile && canSell(profile.role);
}

/* -------------------------------------------------------------------------- *
 * Keanggotaan per-situs (fase 2 dari docs/plans/hierarchical-users.md).
 *
 * Belum mengubah perilaku apa pun: setelah backfill fase 1, satu-satunya orang
 * yang punya keanggotaan `admin` adalah platform admin — yang sudah lolos setiap
 * gate sebelum ini ada. Yang berubah adalah SIAPA yang menjawab pertanyaannya.
 * -------------------------------------------------------------------------- */

/**
 * Role orang yang sedang login di sebuah situs, atau null kalau bukan anggota.
 *
 * `cache()` = memoisasi per-request, bukan cache lintas request: ini data satu
 * orang, tidak boleh masuk `unstable_cache` yang dibagi antar pengunjung.
 * Layar panel memanggilnya beberapa kali dalam satu render.
 */
const readMembership = cache(
  async (userId: string, siteId: string): Promise<SiteRole | null> => {
    if (!userId || !siteId) return null;
    // Service-role: RLS di lp_site_members hanya mengizinkan seseorang membaca
    // barisnya sendiri, dan itu memang cukup di sini — tapi layar admin nanti
    // membaca baris orang lain lewat helper yang sama.
    const { data } = await createAdminClient()
      .from("lp_site_members")
      .select("role")
      .eq("user_id", userId)
      .eq("site_id", siteId)
      .maybeSingle();
    return data ? normalizeSiteRole(data.role) : null;
  },
);

/**
 * Role efektif orang yang sedang login di situs yang sedang dilihat panel.
 *
 * Situsnya boleh dikirim sebagai argumen. Kalau tidak, dipakai cakupan panel —
 * dan itu satu-satunya tempat cookie scope dibaca untuk keputusan izin, supaya
 * tidak ada layar yang diam-diam memutuskan dari cookie sendiri.
 */
export async function currentSiteRole(siteId?: string): Promise<SiteRole | null> {
  const profile = await getProfile();
  if (!profile) return null;
  const id = siteId ?? (await editingSite()).id;
  return effectiveRole(profile.role, await readMembership(profile.id, id));
}

/**
 * Catat orang ini sebagai anggota situs ini, kalau belum.
 *
 * Idempoten dan tidak pernah MENURUNKAN: callback Duitku memang dikirim ulang,
 * dan pembelian kedua oleh seorang admin situs tidak boleh menjadikannya
 * pembeli biasa. Karena itu `ignoreDuplicates` — bukan upsert yang menimpa.
 *
 * Best-effort di semua pemanggilnya: keanggotaan yang gagal tercatat adalah
 * baris yang hilang, sementara melempar error di sini berarti signup gagal atau
 * callback pembayaran tidak dibalas 200 — dua kerugian yang jauh lebih besar.
 */
export async function ensureSiteMembership(
  userId: string,
  siteId: string,
  role: SiteRole = "customer",
): Promise<void> {
  if (!userId || !siteId) return;
  try {
    await createAdminClient()
      .from("lp_site_members")
      .upsert({ site_id: siteId, user_id: userId, role }, {
        onConflict: "site_id,user_id",
        ignoreDuplicates: true,
      });
  } catch (e) {
    console.error("ensureSiteMembership error:", e);
  }
}

/** Boleh mengurus situs ini — kontennya, setelannya, anggotanya. */
export async function requireSiteAdmin(siteId?: string): Promise<boolean> {
  return canManageSite(await currentSiteRole(siteId));
}

/** Boleh membuat & menjual produk DI SITUS INI. */
export async function canSellOnCurrentSite(siteId?: string): Promise<boolean> {
  return canSellOnSite(await currentSiteRole(siteId));
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
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const ids = [...new Set([siteId, canonicalId].filter(Boolean))];
      if (!ids.length) return DEFAULT_ROLE_PERMISSIONS;
      const { data } = await supabase
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
 * Access check for an admin feature. A full admin has everything; otherwise the
 * feature must be granted to the user's role (customer/publisher) at /panel/roles.
 */
export async function requireFeature(feature: FeatureKey): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;
  if (profile.role === "company") return true;
  // Admin DI SITUS yang sedang dilihat punya seluruh fitur untuk situs itu.
  // Agent di situs yang sedang dilihat punya seluruh fitur untuk situs itu.
  if ((await currentSiteRole()) === "agent") return true;
  if (profile.role === "customer" || profile.role === "publisher") {
    const perms = await getRolePermissions();
    return perms[profile.role].includes(feature);
  }
  return false;
}

/** Feature keys the current user can access (all for admins) — drives the nav. */
export async function getAccessibleFeatures(): Promise<FeatureKey[]> {
  const profile = await getProfile();
  if (!profile) return [];
  if (profile.role === "company") return [...ALL_FEATURE_KEYS];
  if ((await currentSiteRole()) === "agent") return [...ALL_FEATURE_KEYS];
  if (profile.role === "customer" || profile.role === "publisher") {
    const perms = await getRolePermissions();
    return perms[profile.role];
  }
  return [];
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  unstable_noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("lp_profiles")
    .select("id, full_name, role, publisher_status, email_verified_at, avatar_url")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    full_name: data.full_name ?? null,
    role: normalizeRole(data.role),
    publisher_status: normalizePublisherStatus(data.publisher_status),
    email_verified_at: data.email_verified_at ?? null,
    avatar_url: data.avatar_url ?? null,
  } as Profile;
});

/**
 * Customer applies to become a publisher. Sets status to "pending" so an admin
 * can review it (role stays "customer" until approved). Idempotent-ish: only
 * customers who are not already pending/approved may apply.
 */
/** Bytes of a `data:image/jpeg;base64,...` string, or null if it isn't one. */
function decodeJpegDataUrl(value: unknown): Buffer | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^data:image\/jpe?g;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  // Real JPEG, and within the bucket's own 5MB ceiling.
  if (buf.length < 1024 || buf.length > 5 * 1024 * 1024) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  return buf;
}

/**
 * Submit a publisher application with the two identity photos.
 *
 * The photos arrive as data URLs and are written with the service role, so the
 * `publisher-kyc` bucket needs no storage policy at all — no signed-in user,
 * the applicant included, can read or overwrite an ID photo through the public
 * API. Only this action writes them and only the admin screen reads them.
 */
/** What the applicant fills in alongside the two identity photos. */
export type PublisherApplication = {
  /** Must match the KTP — the admin compares it against the photo. */
  realName: string;
  /** Public store name. May differ from the legal name; that is the point. */
  displayName: string;
  /** Where the applicant currently lives — often not the KTP address. */
  address: string;
  bankName: string;
  bankHolder: string;
  bankAccount: string;
  /** The terms checkbox. Rejected server-side when false. */
  acceptedTerms: boolean;
};

export async function applyAsPublisher(
  ktp?: string,
  selfie?: string,
  application?: PublisherApplication,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const ktpBytes = decodeJpegDataUrl(ktp);
  const selfieBytes = decodeJpegDataUrl(selfie);
  if (!ktpBytes) return { ok: false, error: "Foto KTP belum diambil." };
  if (!selfieBytes) return { ok: false, error: "Foto selfie belum diambil." };

  // Validated here, not only in the form: this is a server action, so the
  // client-side disabled button is a convenience, not a control.
  const trim = (s: string | undefined) => (s ?? "").trim().replace(/\s+/g, " ");
  const realName = trim(application?.realName);
  const displayName = trim(application?.displayName);
  // Newlines are meaningful in an address, so collapse spaces per line rather
  // than flattening the whole thing into one run.
  const address = (application?.address ?? "")
    .split("\n")
    .map((l) => l.trim().replace(/[ \t]+/g, " "))
    .filter(Boolean)
    .join("\n");
  const bankName = trim(application?.bankName);
  const bankHolder = trim(application?.bankHolder);
  const bankAccount = trim(application?.bankAccount);

  if (realName.length < 3) return { ok: false, error: "Nama sesuai KTP wajib diisi." };
  if (displayName.length < 3) return { ok: false, error: "Nama toko wajib diisi." };
  if (address.length < 10)
    return { ok: false, error: "Alamat tempat tinggal wajib diisi selengkapnya." };
  if (address.length > 400) return { ok: false, error: "Alamat terlalu panjang." };
  if (!bankName) return { ok: false, error: "Nama bank wajib diisi." };
  if (!bankHolder) return { ok: false, error: "Nama pemilik rekening wajib diisi." };
  if (!bankAccount) return { ok: false, error: "Nomor rekening wajib diisi." };
  if (!application?.acceptedTerms)
    return { ok: false, error: "Anda harus menyetujui ketentuan publisher." };

  // Guard against the field lengths a free-text form invites. Generous caps —
  // the aim is to stop abuse, not to second-guess unusual but valid names.
  const tooLong = [realName, displayName, bankName, bankHolder, bankAccount].some(
    (v) => v.length > 120,
  );
  if (tooLong) return { ok: false, error: "Isian terlalu panjang (maksimal 120 karakter)." };

  const { data: current } = await supabase
    .from("lp_profiles")
    .select("role, publisher_status")
    .eq("id", user.id)
    .single();

  const role = normalizeRole(current?.role);
  const status = normalizePublisherStatus(current?.publisher_status);

  if (role === "company") return { ok: false, error: "Admin tidak perlu mengajukan." };
  if (role === "publisher" || status === "approved")
    return { ok: false, error: "Anda sudah menjadi publisher." };
  if (status === "pending") return { ok: false, error: "Pengajuan Anda sedang ditinjau." };

  // Privileged write: authenticated users cannot update publisher_status on their
  // own row (column grant), so this transition runs through the service-role
  // client. Still safe — the action authenticated the user and only touches
  // their own id, keeping status at "pending" (admin decides approval).
  const admin = createAdminClient();

  // Timestamped names so a re-application never overwrites the photos an admin
  // may still be looking at, and so a stale signed URL can't resolve to a new
  // person's document.
  const stamp = Date.now();
  const ktpPath = `${user.id}/ktp-${stamp}.jpg`;
  const selfiePath = `${user.id}/selfie-${stamp}.jpg`;

  for (const [path, bytes] of [
    [ktpPath, ktpBytes],
    [selfiePath, selfieBytes],
  ] as const) {
    const { error: upErr } = await admin.storage
      .from("publisher-kyc")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      console.error("applyAsPublisher upload error:", upErr);
      return { ok: false, error: "Gagal mengunggah foto. Coba lagi." };
    }
  }

  const { error } = await admin
    .from("lp_profiles")
    .update({
      publisher_status: "pending",
      publisher_applied_at: new Date().toISOString(),
      publisher_ktp_path: ktpPath,
      publisher_selfie_path: selfiePath,
      publisher_real_name: realName,
      publisher_address: address,
      publisher_display_name: displayName,
      publisher_bank_name: bankName,
      publisher_bank_holder: bankHolder,
      publisher_bank_account: bankAccount,
      // Recorded as a timestamp so acceptance can be audited against the terms
      // text that was in force at that moment.
      publisher_terms_accepted_at: new Date().toISOString(),
      // A fresh application starts with a clean slate.
      publisher_reject_note: null,
      publisher_reviewed_at: null,
      publisher_reviewed_by: null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("applyAsPublisher error:", error);
    return { ok: false, error: "Gagal mengirim pengajuan." };
  }
  revalidatePath("/panel/profile");
  return { ok: true };
}

export type ProfileWithUser = {
  id: string;
  full_name: string | null;
  role: Role;
  publisher_status: PublisherStatus;
  email: string | null;
};

/** For profile page: profile + email from auth. Returns null if not logged in. */
export async function getProfileWithUser(): Promise<ProfileWithUser | null> {
  unstable_noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data, error } = await supabase
    .from("lp_profiles")
    .select("id, full_name, role, publisher_status")
    .eq("id", user.id)
    .single();

  if ((error || !data) && user) {
    const { error: insertError } = await supabase.from("lp_profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? null,
      role: "customer",
    });
    if (!insertError || insertError.code === "23505") {
      const ret = await supabase
        .from("lp_profiles")
        .select("id, full_name, role, publisher_status")
        .eq("id", user.id)
        .single();
      data = ret.data;
      error = ret.error;
    }
  }

  if (error || !data) return null;
  return {
    id: data.id,
    full_name: data.full_name ?? null,
    role: normalizeRole(data.role),
    publisher_status: normalizePublisherStatus(data.publisher_status),
    email: user.email ?? null,
  };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const full_name = (formData.get("full_name") as string)?.trim() ?? "";
  const { error } = await supabase
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
 * Set the signed-in user's picture. Any role: a buyer, a publisher and an admin
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const { error } = await supabase
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const { error } = await supabase
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
