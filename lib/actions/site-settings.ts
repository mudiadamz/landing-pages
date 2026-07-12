"use server";

import { unstable_cache, updateTag, revalidatePath } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./profiles";
import { DEFAULT_HERO, normalizeHero, type HeroConfig } from "@/lib/hero-config";
import { DEFAULT_CONTENT, normalizeContent, type SiteContent } from "@/lib/content-config";

const CUSTOM_JS_KEY = "custom_js";
const HERO_KEY = "hero";
const CONTENT_KEY = "site_content";

/* Hero section config (editable from /panel/hero, stored as JSON in
 * lp_site_settings.value under key "hero"). Types/defaults live in
 * lib/hero-config.ts so this "use server" file only exports async functions. */

export const getHero = unstable_cache(
  async (): Promise<HeroConfig> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("key", HERO_KEY)
        .single();
      if (!data?.value) return DEFAULT_HERO;
      return normalizeHero(JSON.parse(data.value as string));
    } catch {
      return DEFAULT_HERO;
    }
  },
  ["hero-config"],
  { revalidate: 120, tags: ["hero-config"] },
);

export async function updateHero(config: HeroConfig): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeHero(config);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      { key: HERO_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    console.error("updateHero error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  updateTag("hero-config");
  revalidatePath("/");
  return { ok: true };
}

/* Editable homepage copy (footer tagline + disclaimer/FAQ section), edited from
 * /panel/content, stored as JSON in lp_site_settings.value under "site_content".
 * Types/defaults live in lib/content-config.ts. */

export const getSiteContent = unstable_cache(
  async (): Promise<SiteContent> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("key", CONTENT_KEY)
        .single();
      if (!data?.value) return DEFAULT_CONTENT;
      return normalizeContent(JSON.parse(data.value as string));
    } catch {
      return DEFAULT_CONTENT;
    }
  },
  ["site-content"],
  { revalidate: 120, tags: ["site-content"] },
);

export async function updateSiteContent(content: SiteContent): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeContent(content);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      { key: CONTENT_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    console.error("updateSiteContent error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  updateTag("site-content");
  revalidatePath("/", "layout");
  return { ok: true };
}

export const getCustomJs = unstable_cache(
  async (): Promise<string> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("key", CUSTOM_JS_KEY)
        .single();
      return (data?.value as string) ?? "";
    } catch {
      return "";
    }
  },
  ["custom-js"],
  { revalidate: 120 },
);

export async function updateCustomJs(script: string): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert({ key: CUSTOM_JS_KEY, value: script.trim(), updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    console.error("updateCustomJs error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  return { ok: true };
}
