"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VersionRow = {
  id: string;
  landing_page_id: string;
  html_content: string;
  created_at: string;
};

export async function saveVersion(landingPageId: string, htmlContent: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("landing_page_versions")
    .insert({ landing_page_id: landingPageId, html_content: htmlContent });

  if (error) throw error;

  revalidatePath(`/panel/landing-pages/${landingPageId}/edit`);
}

export async function getVersions(landingPageId: string): Promise<VersionRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("landing_page_versions")
    .select("id, landing_page_id, html_content, created_at")
    .eq("landing_page_id", landingPageId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];
  return (data ?? []) as VersionRow[];
}

export async function restoreVersion(versionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: version, error: fetchErr } = await supabase
    .from("landing_page_versions")
    .select("landing_page_id, html_content")
    .eq("id", versionId)
    .single();

  if (fetchErr || !version) throw new Error("Version not found");

  const { error: updateErr } = await supabase
    .from("landing_pages")
    .update({ html_content: version.html_content })
    .eq("id", version.landing_page_id)
    .eq("user_id", user.id);

  if (updateErr) throw updateErr;

  revalidatePath("/panel");
  revalidatePath(`/panel/landing-pages/${version.landing_page_id}/edit`);

  return version.html_content;
}
