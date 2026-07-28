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
};

/** Only users with profile.role === "admin" are admin. No fallback for missing profile. */
export async function requireAdmin() {
  const profile = await getProfile();
  return profile?.role === "admin";
}

/** Admin or approved publisher — may create & sell products. */
export async function canSellProducts() {
  const profile = await getProfile();
  return !!profile && canSell(profile.role);
}

/** Feature access per role (admin = all), configured at /panel/roles. Cached. */
export const getRolePermissions = unstable_cache(
  async (): Promise<RolePermissions> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("key", "role_permissions")
        .single();
      if (!data?.value) return DEFAULT_ROLE_PERMISSIONS;
      return normalizeRolePermissions(JSON.parse(data.value as string));
    } catch {
      return DEFAULT_ROLE_PERMISSIONS;
    }
  },
  ["role-permissions"],
  { revalidate: 120, tags: ["role-permissions"] },
);

/**
 * Access check for an admin feature. A full admin has everything; otherwise the
 * feature must be granted to the user's role (customer/publisher) at /panel/roles.
 */
export async function requireFeature(feature: FeatureKey): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;
  if (profile.role === "admin") return true;
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
  if (profile.role === "admin") return [...ALL_FEATURE_KEYS];
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
    .select("id, full_name, role, publisher_status, email_verified_at")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    full_name: data.full_name ?? null,
    role: normalizeRole(data.role),
    publisher_status: normalizePublisherStatus(data.publisher_status),
    email_verified_at: data.email_verified_at ?? null,
  } as Profile;
});

/**
 * Customer applies to become a publisher. Sets status to "pending" so an admin
 * can review it (role stays "customer" until approved). Idempotent-ish: only
 * customers who are not already pending/approved may apply.
 */
export async function applyAsPublisher(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const { data: current } = await supabase
    .from("lp_profiles")
    .select("role, publisher_status")
    .eq("id", user.id)
    .single();

  const role = normalizeRole(current?.role);
  const status = normalizePublisherStatus(current?.publisher_status);

  if (role === "admin") return { ok: false, error: "Admin tidak perlu mengajukan." };
  if (role === "publisher" || status === "approved")
    return { ok: false, error: "Anda sudah menjadi publisher." };
  if (status === "pending") return { ok: false, error: "Pengajuan Anda sedang ditinjau." };

  // Privileged write: authenticated users cannot update publisher_status on their
  // own row (column grant), so this transition runs through the service-role
  // client. Still safe — the action authenticated the user and only touches
  // their own id, keeping status at "pending" (admin decides approval).
  const admin = createAdminClient();
  const { error } = await admin
    .from("lp_profiles")
    .update({ publisher_status: "pending", publisher_applied_at: new Date().toISOString() })
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
