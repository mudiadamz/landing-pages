"use server";

import { unstable_cache, updateTag, revalidatePath } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireFeature, requireAdmin } from "./profiles";
import { normalizeRolePermissions, type RolePermissions } from "@/lib/role-permissions";
import { DEFAULT_HERO, normalizeHero, type HeroConfig } from "@/lib/hero-config";
import { DEFAULT_CONTENT, normalizeContent, type SiteContent } from "@/lib/content-config";
import { normalizeTracking, normalizeGtmId, type TrackingConfig } from "@/lib/tracking-config";

const CUSTOM_JS_KEY = "custom_js";
const HERO_KEY = "hero";
const CONTENT_KEY = "site_content";
const ROLE_PERMS_KEY = "role_permissions";
const TRACKING_KEY = "tracking";

/* Role-based feature access (edited at /panel/roles). The cached reader lives in
 * lib/actions/profiles.ts (getRolePermissions); this is the admin-only writer. */
export async function updateRolePermissions(
  perms: RolePermissions,
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeRolePermissions(perms);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      { key: ROLE_PERMS_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    console.error("updateRolePermissions error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  updateTag("role-permissions");
  revalidatePath("/panel", "layout");
  return { ok: true };
}

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
  const isAdmin = await requireFeature("hero");
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
  const isAdmin = await requireFeature("content");
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
  const isAdmin = await requireFeature("custom-js");
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

/* Tracking tags (Google Tag Manager). Stored as JSON under key "tracking";
 * falls back to the NEXT_PUBLIC_GTM_ID env var when nothing is saved so the id
 * can be configured either in the panel or in Vercel. See lib/tracking-config.ts. */

export const getTracking = unstable_cache(
  async (): Promise<TrackingConfig> => {
    const envFallback = normalizeGtmId(process.env.NEXT_PUBLIC_GTM_ID);
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("key", TRACKING_KEY)
        .single();
      if (!data?.value) return { gtmId: envFallback };
      const cfg = normalizeTracking(JSON.parse(data.value as string));
      return { gtmId: cfg.gtmId || envFallback };
    } catch {
      return { gtmId: envFallback };
    }
  },
  ["tracking-config"],
  { revalidate: 120, tags: ["tracking-config"] },
);

export async function updateTracking(config: TrackingConfig): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  // Reject a non-empty id that doesn't look like a GTM container.
  const gtmId = normalizeGtmId(config.gtmId);
  if (config.gtmId?.trim() && !gtmId) {
    return { ok: false, error: "ID GTM tidak valid. Format: GTM-XXXXXXX." };
  }

  const clean = normalizeTracking({ gtmId });
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      { key: TRACKING_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    console.error("updateTracking error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  updateTag("tracking-config");
  revalidatePath("/", "layout");
  return { ok: true };
}
