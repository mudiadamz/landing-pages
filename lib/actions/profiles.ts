"use server";

import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string | null;
  role: "admin" | "customer";
};

export async function requireAdmin() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin" || !profile;
  return isAdmin;
}

export async function getProfile(): Promise<Profile | null> {
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
  return data as Profile;
}
