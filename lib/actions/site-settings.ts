"use server";

import { unstable_cache, updateTag, revalidatePath } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireFeature, requireAdmin } from "./profiles";
import { normalizeRolePermissions, type RolePermissions } from "@/lib/role-permissions";
import { DEFAULT_HERO, normalizeHero, type HeroConfig } from "@/lib/hero-config";
import { DEFAULT_CONTENT, normalizeContent, type SiteContent } from "@/lib/content-config";
import { normalizeTracking, normalizeGtmId, type TrackingConfig } from "@/lib/tracking-config";
import { DEFAULT_PALETTE, normalizePalette, type PaletteConfig } from "@/lib/palette";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_POPUP,
  normalizePopup,
  POPUP_SETTINGS_KEY,
  type PopupBanner,
} from "@/lib/popup-config";
import { POPUP_MAX_BYTES, readWebpHeader } from "@/lib/webp";

const CUSTOM_JS_KEY = "custom_js";
const HERO_KEY = "hero";
const CONTENT_KEY = "site_content";
const ROLE_PERMS_KEY = "role_permissions";
const TRACKING_KEY = "tracking";
const PALETTE_KEY = "panel_palette";

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

/* Panel colour palette (edited at /panel/appearance, stored as JSON in
 * lp_site_settings under "panel_palette"). Read on every panel render, so it is
 * cached and invalidated by tag on save. */

export const getPanelPalette = unstable_cache(
  async (): Promise<PaletteConfig> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("key", PALETTE_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_PALETTE;
      return normalizePalette(JSON.parse(data.value as string));
    } catch {
      // A palette is decoration; never let it take the panel down with it.
      return DEFAULT_PALETTE;
    }
  },
  ["panel-palette"],
  { revalidate: 300, tags: ["panel-palette"] },
);

export async function updatePanelPalette(
  config: PaletteConfig,
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const clean = normalizePalette(config);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      { key: PALETTE_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    console.error("updatePanelPalette error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  updateTag("panel-palette");
  revalidatePath("/panel", "layout");
  return { ok: true };
}

/* Popup banner over the product preview. Types/defaults in lib/popup-config.ts. */

export const getPopupBanner = unstable_cache(
  async (): Promise<PopupBanner> => {
    try {
      // Anon client built directly, NOT lib/supabase/server's createClient: that
      // one reads cookies(), and Next refuses dynamic data sources inside
      // unstable_cache. It throws, the catch below turns it into DEFAULT_POPUP,
      // and DEFAULT_POPUP is `enabled: false` — so the banner was silently off
      // everywhere no matter what the panel said. Every other reader in this
      // file already does it this way; this one was written later and copied the
      // wrong neighbour. The config is public site settings, so there is no
      // session to carry anyway.
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("key", POPUP_SETTINGS_KEY)
        .single();
      if (!data?.value) return DEFAULT_POPUP;
      return normalizePopup(JSON.parse(data.value as string));
    } catch (e) {
      // Loudly: the fallback disables the feature, so a silent catch here is
      // indistinguishable from "admin turned it off" and hid this bug for days.
      console.error("getPopupBanner failed, falling back to disabled:", e);
      return DEFAULT_POPUP;
    }
  },
  ["popup-banner"],
  { revalidate: 300, tags: ["popup-banner"] },
);

export async function updatePopupBanner(config: PopupBanner): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = normalizePopup(config);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      { key: POPUP_SETTINGS_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    console.error("updatePopupBanner error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  updateTag("popup-banner");
  return { ok: true };
}

/**
 * Upload the popup image.
 *
 * WebP only, and enforced here rather than trusted from the file picker: the
 * point of the format requirement is weight on a page that must not get heavier,
 * so a PNG renamed .webp has to fail. The magic bytes are checked, not the
 * declared MIME type.
 */
export async function uploadPopupImage(
  form: FormData,
): Promise<{ ok: boolean; url?: string; width?: number; height?: number; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "File tidak ditemukan." };
  if (file.size > POPUP_MAX_BYTES)
    return {
      ok: false,
      error: `Ukuran maksimal ${Math.round(POPUP_MAX_BYTES / 1024)} KB — kompres dulu.`,
    };

  const bytes = Buffer.from(await file.arrayBuffer());
  const dims = readWebpHeader(bytes);
  if (!dims) return { ok: false, error: "File harus WebP asli (bukan hasil rename)." };

  const admin = createAdminClient();
  // Prefix stays "promo/" through the popup rename: already-uploaded images live
  // under it and their public URLs are what the stored config points at.
  const path = `promo/${Date.now()}.webp`;
  const { error } = await admin.storage
    .from("landing-assets")
    .upload(path, bytes, { contentType: "image/webp", upsert: false });
  if (error) {
    console.error("uploadPopupImage error:", error);
    return { ok: false, error: "Gagal mengunggah." };
  }

  const { data } = admin.storage.from("landing-assets").getPublicUrl(path);
  return { ok: true, url: data.publicUrl, width: dims.width, height: dims.height };
}

/**
 * Store an email volunteered from the popup banner.
 *
 * Written with the service role because lp_promo_subscribers has RLS on and no
 * policies — an anonymous reader is the one subscribing, and a public INSERT
 * policy would let anyone flood or enumerate the table through the REST API.
 *
 * Re-subscribing is a success, not an error: a reader who submits twice should
 * see the thank-you, not a failure they can do nothing about.
 */
export async function subscribePopupEmail(
  email: string,
  sourceSlug?: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 254) {
    return { ok: false, error: "Email tidak valid." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("lp_promo_subscribers")
    .upsert(
      { email: clean, source_slug: sourceSlug?.slice(0, 120) ?? null },
      { onConflict: "email", ignoreDuplicates: true },
    );

  if (error) {
    console.error("subscribePopupEmail error:", error);
    return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  }
  return { ok: true };
}
