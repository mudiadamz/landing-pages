"use server";

import { unstable_noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string | null;
  role: "admin" | "customer";
};

function normalizeRole(value: unknown): "admin" | "customer" {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "admin" ? "admin" : "customer";
}

/** Only users with profile.role === "admin" are admin. No fallback for missing profile. */
export async function requireAdmin() {
  const profile = await getProfile();
  return profile?.role === "admin";
}

export async function getProfile(): Promise<Profile | null> {
  unstable_noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    full_name: data.full_name ?? null,
    role: normalizeRole(data.role),
  } as Profile;
}

export type ProfileWithUser = {
  id: string;
  full_name: string | null;
  role: "admin" | "customer";
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
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if ((error || !data) && user) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? null,
      role: "customer",
    });
    if (!insertError || insertError.code === "23505") {
      const ret = await supabase
        .from("profiles")
        .select("id, full_name, role")
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
    .from("profiles")
    .update({ full_name: full_name || null })
    .eq("id", user.id);

  if (error) {
    console.error("updateProfile error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  return { ok: true };
}
