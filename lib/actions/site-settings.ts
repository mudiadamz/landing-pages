"use server";

import { unstable_cache, updateTag, revalidateTag, revalidatePath } from "next/cache";
import { DEFAULT_SOCIAL_URLS, normalizeSocialUrls, type SocialUrls } from "@/lib/social";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireFeature, requireAdmin } from "./profiles";
import { normalizeRolePermissions, type RolePermissions } from "@/lib/role-permissions";
import { DEFAULT_HERO, normalizeHero, type HeroConfig } from "@/lib/hero-config";
import { DEFAULT_CONTENT, normalizeContent, type SiteContent } from "@/lib/content-config";
import { DEFAULT_LEGAL, normalizeLegal, type LegalContent } from "@/lib/legal-config";
import { DEFAULT_HIRING, normalizeHiring, type HiringContent } from "@/lib/hiring-config";
import { normalizeTracking, normalizeGtmId, type TrackingConfig } from "@/lib/tracking-config";
import { DEFAULT_PALETTE, normalizePalette, type PaletteConfig } from "@/lib/palette";
import {
  DEFAULT_PLAN_META,
  DEFAULT_PLAN_PRICES,
  normalizePlanMeta,
  normalizePlanPrices,
  normalizePlanLimitsOverrides,
  type PlanLimitsOverrides,
  type PlanMeta,
  type PlanPrices,
} from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_POPUP,
  normalizePopup,
  POPUP_SETTINGS_KEY,
  type PopupBanner,
} from "@/lib/popup-config";
import { POPUP_MAX_BYTES, readWebpHeader } from "@/lib/webp";
import { canonicalSiteId, currentSiteId } from "@/lib/site-resolve";
import { sanitizePageHtml } from "@/lib/page-html";

const CUSTOM_JS_KEY = "custom_js";
const HERO_KEY = "hero";
const CONTENT_KEY = "site_content";
const LEGAL_KEY = "legal_content";
const HIRING_KEY = "hiring_content";
const ROLE_PERMS_KEY = "role_permissions";
const TRACKING_KEY = "tracking";
const PALETTE_KEY = "panel_palette";
const OTHER_LINKS_KEY = "other_links";
const SOCIAL_KEY = "social_links";
const PLAN_PRICES_KEY = "plan_prices";
const PLAN_LIMITS_KEY = "plan_limits";
const PLAN_META_KEY = "plan_meta";

/* Role-based feature access (edited at /panel/roles). The cached reader lives in
 * lib/actions/profiles.ts (getRolePermissions); this is the admin-only writer. */
export async function updateRolePermissions(
  perms: RolePermissions,
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeRolePermissions(perms);
  const supabase = await createClient();
  // Not per-site: who may do what is a property of the panel, which only the
  // canonical domain serves.
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      {
        site_id: await canonicalSiteId(),
        key: ROLE_PERMS_KEY,
        value: JSON.stringify(clean),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,key" },
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

const readHero = unstable_cache(
  async (siteId: string): Promise<HeroConfig> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", HERO_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_HERO;
      return normalizeHero(JSON.parse(data.value as string));
    } catch {
      return DEFAULT_HERO;
    }
  },
  ["hero-config"],
  { revalidate: 120, tags: ["hero-config"] },
);

export async function getHero(siteId?: string): Promise<HeroConfig> {
  return readHero(siteId ?? (await currentSiteId()));
}

export async function updateHero(
  config: HeroConfig,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireFeature("hero");
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeHero(config);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      {
        site_id: siteId ?? (await currentSiteId()),
        key: HERO_KEY,
        value: JSON.stringify(clean),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,key" },
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

const readSiteContent = unstable_cache(
  async (siteId: string): Promise<SiteContent> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", CONTENT_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_CONTENT;
      return normalizeContent(JSON.parse(data.value as string));
    } catch {
      return DEFAULT_CONTENT;
    }
  },
  ["site-content"],
  { revalidate: 120, tags: ["site-content"] },
);

export async function getSiteContent(siteId?: string): Promise<SiteContent> {
  return readSiteContent(siteId ?? (await currentSiteId()));
}

export async function updateSiteContent(
  content: SiteContent,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireFeature("content");
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeContent(content);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      {
        site_id: siteId ?? (await currentSiteId()),
        key: CONTENT_KEY,
        value: JSON.stringify(clean),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,key" },
    );

  if (error) {
    console.error("updateSiteContent error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  updateTag("site-content");
  revalidatePath("/", "layout");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Legal pages (privacy / terms / refund) and the hiring ad                    */
/* -------------------------------------------------------------------------- */

/*
 * Both are fixed surfaces with copy an admin owns, so they follow the same
 * shape as site_content above: one JSON blob per site, read through
 * unstable_cache with the anon client, written through the cookie client behind
 * a feature gate.
 *
 * The reads deliberately swallow errors into the shipped defaults. A legal page
 * is linked from every footer and required to exist; a database hiccup should
 * degrade it to the default text, never to a 500.
 */

const readLegalContent = unstable_cache(
  async (siteId: string): Promise<LegalContent> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", LEGAL_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_LEGAL;
      return normalizeLegal(JSON.parse(data.value as string));
    } catch {
      return DEFAULT_LEGAL;
    }
  },
  ["legal-content"],
  { revalidate: 120, tags: ["legal-content"] },
);

export async function getLegalContent(siteId?: string): Promise<LegalContent> {
  return readLegalContent(siteId ?? (await currentSiteId()));
}

export async function updateLegalContent(
  content: LegalContent,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const allowed = await requireFeature("legal");
  if (!allowed) return { ok: false, error: "Akses ditolak." };

  // Sanitised here rather than in the form: the action is the only way in, and
  // an admin pasting a tracking pixel into a privacy policy is exactly the
  // stored mistake lib/page-html exists to catch.
  const clean = normalizeLegal({
    ...content,
    privacy: { ...content.privacy, body: sanitizePageHtml(content.privacy?.body ?? "") },
    terms: { ...content.terms, body: sanitizePageHtml(content.terms?.body ?? "") },
    refund: { ...content.refund, body: sanitizePageHtml(content.refund?.body ?? "") },
    // Stamped on write, so "Terakhir diperbarui" is the date of the last edit
    // rather than the date the reader happens to be looking.
    updatedAt: new Date().toISOString(),
  });

  const supabase = await createClient();
  const { error } = await supabase.from("lp_site_settings").upsert(
    {
      site_id: siteId ?? (await currentSiteId()),
      key: LEGAL_KEY,
      value: JSON.stringify(clean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,key" },
  );

  if (error) {
    console.error("updateLegalContent error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  revalidateTag("legal-content", "max");
  revalidatePath("/privacy");
  revalidatePath("/terms");
  revalidatePath("/refund");
  return { ok: true };
}

const readHiringContent = unstable_cache(
  async (siteId: string): Promise<HiringContent> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", HIRING_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_HIRING;
      return normalizeHiring(JSON.parse(data.value as string));
    } catch {
      return DEFAULT_HIRING;
    }
  },
  ["hiring-content"],
  { revalidate: 120, tags: ["hiring-content"] },
);

export async function getHiringContent(siteId?: string): Promise<HiringContent> {
  return readHiringContent(siteId ?? (await currentSiteId()));
}

export async function updateHiringContent(
  content: HiringContent,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const allowed = await requireFeature("hiring");
  if (!allowed) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeHiring(content);
  const supabase = await createClient();
  const { error } = await supabase.from("lp_site_settings").upsert(
    {
      site_id: siteId ?? (await currentSiteId()),
      key: HIRING_KEY,
      value: JSON.stringify(clean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,key" },
  );

  if (error) {
    console.error("updateHiringContent error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  revalidateTag("hiring-content", "max");
  revalidatePath("/hiring");
  revalidatePath("/hiring/test");
  // The footer's Hiring link appears and disappears with `enabled`.
  revalidatePath("/", "layout");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Other links — the storefront owner's other places on the internet          */
/* -------------------------------------------------------------------------- */

export type OtherLink = {
  label: string;
  url: string;
  /** One line under the label. Optional. */
  note: string;
};

/** Enough to fill a sheet without turning it into a directory. */
const MAX_OTHER_LINKS = 20;

/**
 * A stored list, cleaned on the way in AND on the way out.
 *
 * Only http(s) survives: the label and URL are rendered into an anchor on a
 * public page, so a `javascript:` href would be stored XSS with a nice title on
 * it. Rows without both a label and a usable URL are dropped rather than
 * rendered as a dead entry.
 */
function normalizeOtherLinks(raw: unknown): OtherLink[] {
  if (!Array.isArray(raw)) return [];
  const out: OtherLink[] = [];
  for (const item of raw) {
    const v = (item ?? {}) as Partial<OtherLink>;
    const label = typeof v.label === "string" ? v.label.trim().slice(0, 80) : "";
    const url = typeof v.url === "string" ? v.url.trim().slice(0, 500) : "";
    const note = typeof v.note === "string" ? v.note.trim().slice(0, 120) : "";
    if (!label || !url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({ label, url, note });
    if (out.length >= MAX_OTHER_LINKS) break;
  }
  return out;
}

const readOtherLinks = unstable_cache(
  async (siteId: string): Promise<OtherLink[]> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", OTHER_LINKS_KEY)
        .maybeSingle();
      if (!data?.value) return [];
      return normalizeOtherLinks(JSON.parse(data.value as string));
    } catch {
      return [];
    }
  },
  ["other-links"],
  { revalidate: 120, tags: ["other-links"] },
);

export async function getOtherLinks(siteId?: string): Promise<OtherLink[]> {
  return readOtherLinks(siteId ?? (await currentSiteId()));
}

export async function updateOtherLinks(
  links: OtherLink[],
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeOtherLinks(links);
  const supabase = await createClient();
  const { error } = await supabase.from("lp_site_settings").upsert(
    {
      site_id: siteId ?? (await currentSiteId()),
      key: OTHER_LINKS_KEY,
      value: JSON.stringify(clean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,key" },
  );

  if (error) {
    console.error("updateOtherLinks error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  // revalidateTag(tag, "max") and not updateTag: updateTag only knows fetch tags
  // and cacheTag() inside 'use cache', NOT the { tags: [...] } option this file's
  // readers use (docs/architecture.md I3). Every other writer here still calls
  // updateTag and is presumably subject to the same 120s delay — worth a sweep,
  // but not a thing to fix silently in passing.
  revalidateTag("other-links", "max");
  revalidatePath("/", "layout");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Social profiles                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The URL per network, editable at /panel/links.
 *
 * Only the ADDRESS is data. The glyph and the brand colour stay in code
 * (components/social-links) because they belong to the network, not to the
 * storefront — nobody should be able to point the Instagram icon at YouTube.
 *
 * An empty string hides that network entirely, which is how a storefront with
 * no TikTok stops showing a TikTok icon.
 */
const readSocialUrls = unstable_cache(
  async (siteId: string): Promise<SocialUrls> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", SOCIAL_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_SOCIAL_URLS;
      return normalizeSocialUrls(JSON.parse(data.value as string));
    } catch {
      return DEFAULT_SOCIAL_URLS;
    }
  },
  ["social-links"],
  { revalidate: 120, tags: ["social-links"] },
);

export async function getSocialUrls(siteId?: string): Promise<SocialUrls> {
  return readSocialUrls(siteId ?? (await currentSiteId()));
}

export async function updateSocialUrls(
  urls: SocialUrls,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = normalizeSocialUrls(urls);
  const supabase = await createClient();
  const { error } = await supabase.from("lp_site_settings").upsert(
    {
      site_id: siteId ?? (await currentSiteId()),
      key: SOCIAL_KEY,
      value: JSON.stringify(clean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,key" },
  );

  if (error) {
    console.error("updateSocialUrls error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  revalidateTag("social-links", "max");
  revalidatePath("/", "layout");
  return { ok: true };
}

const readCustomJs = unstable_cache(
  async (siteId: string): Promise<string> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", CUSTOM_JS_KEY)
        .maybeSingle();
      return (data?.value as string) ?? "";
    } catch {
      return "";
    }
  },
  ["custom-js"],
  { revalidate: 120 },
);

export async function getCustomJs(siteId?: string): Promise<string> {
  return readCustomJs(siteId ?? (await currentSiteId()));
}

export async function updateCustomJs(
  script: string,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireFeature("custom-js");
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const supabase = await createClient();
  const { error } = await supabase.from("lp_site_settings").upsert(
    {
      site_id: siteId ?? (await currentSiteId()),
      key: CUSTOM_JS_KEY,
      value: script.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,key" },
  );

  if (error) {
    console.error("updateCustomJs error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  return { ok: true };
}

/* Tracking tags (Google Tag Manager). Stored as JSON under key "tracking";
 * falls back to the NEXT_PUBLIC_GTM_ID env var when nothing is saved so the id
 * can be configured either in the panel or in Vercel. See lib/tracking-config.ts. */

const readTracking = unstable_cache(
  async (siteId: string): Promise<TrackingConfig> => {
    const envFallback = normalizeGtmId(process.env.NEXT_PUBLIC_GTM_ID);
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", TRACKING_KEY)
        .maybeSingle();
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

/** Per-site: a niche storefront usually wants its own GTM container. */
export async function getTracking(siteId?: string): Promise<TrackingConfig> {
  return readTracking(siteId ?? (await currentSiteId()));
}

export async function updateTracking(
  config: TrackingConfig,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
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
      {
        site_id: siteId ?? (await currentSiteId()),
        key: TRACKING_KEY,
        value: JSON.stringify(clean),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,key" },
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

/* NOT per-site: the palette dresses the panel, which lives only on the canonical
   domain. Pinned there so there is one row rather than a copy per storefront. */

const readPanelPalette = unstable_cache(
  async (siteId: string): Promise<PaletteConfig> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
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

export async function getPanelPalette(): Promise<PaletteConfig> {
  return readPanelPalette(await canonicalSiteId());
}

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
      {
        site_id: await canonicalSiteId(),
        key: PALETTE_KEY,
        value: JSON.stringify(clean),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,key" },
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

const readPopupBanner = unstable_cache(
  async (siteId: string): Promise<PopupBanner> => {
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
        .eq("site_id", siteId)
        .eq("key", POPUP_SETTINGS_KEY)
        .maybeSingle();
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

export async function getPopupBanner(siteId?: string): Promise<PopupBanner> {
  return readPopupBanner(siteId ?? (await currentSiteId()));
}

export async function updatePopupBanner(
  config: PopupBanner,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = normalizePopup(config);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_site_settings")
    .upsert(
      {
        site_id: siteId ?? (await currentSiteId()),
        key: POPUP_SETTINGS_KEY,
        value: JSON.stringify(clean),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,key" },
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

/* -------------------------------------------------------------------------- */
/*  Plan prices                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What each paid plan costs per month ON THIS STOREFRONT.
 *
 * Per-site, like every other setting here, because two storefronts on one
 * deployment sell to different audiences at different money. The PLAN itself is
 * global to the account (lp_profiles.plan) — somebody who buys Pro on one
 * storefront is Pro everywhere, which is the only reading that does not require
 * explaining to a customer why their paid plan vanished on another domain.
 */
const readPlanPrices = unstable_cache(
  async (siteId: string): Promise<PlanPrices> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", PLAN_PRICES_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_PLAN_PRICES;
      return normalizePlanPrices(JSON.parse(data.value as string));
    } catch {
      // Nothing sellable beats a wrong price: a read that failed must not fall
      // back to a number somebody could be charged.
      return DEFAULT_PLAN_PRICES;
    }
  },
  ["plan-prices"],
  { revalidate: 120, tags: ["plan-prices"] },
);

export async function getPlanPrices(siteId?: string): Promise<PlanPrices> {
  return readPlanPrices(siteId ?? (await currentSiteId()));
}

export async function updatePlanPrices(
  prices: PlanPrices,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = normalizePlanPrices(prices);
  const supabase = await createClient();
  const { error } = await supabase.from("lp_site_settings").upsert(
    {
      site_id: siteId ?? (await currentSiteId()),
      key: PLAN_PRICES_KEY,
      value: JSON.stringify(clean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,key" },
  );

  if (error) {
    console.error("updatePlanPrices error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  revalidateTag("plan-prices", "max");
  revalidatePath("/upgrade");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Plan limits                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What this storefront has changed about its plans' limits.
 *
 * Per-site like the price, and for the same reason: the owner pays the model bill
 * for the visitors on THEIR domain. A visitor's plan is global (one account, one
 * plan) but what that plan is worth is decided by the storefront they are using —
 * so somebody's Pro can include web search on one domain and not on another, and
 * both storefronts are telling the truth about their own costs.
 *
 * An empty object is the normal state: unedited plans follow lib/plans.ts, so a
 * later change to the shipped defaults still reaches every site that never
 * overrode them.
 */
const readPlanLimits = unstable_cache(
  async (siteId: string): Promise<PlanLimitsOverrides> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", PLAN_LIMITS_KEY)
        .maybeSingle();
      if (!data?.value) return {};
      return normalizePlanLimitsOverrides(JSON.parse(data.value as string));
    } catch {
      // The shipped defaults, not an open door: a failed read must not hand
      // anybody a bigger quota than the plan they are on.
      return {};
    }
  },
  ["plan-limits"],
  { revalidate: 120, tags: ["plan-limits"] },
);

export async function getPlanLimits(siteId?: string): Promise<PlanLimitsOverrides> {
  return readPlanLimits(siteId ?? (await currentSiteId()));
}

export async function updatePlanLimits(
  overrides: PlanLimitsOverrides,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = normalizePlanLimitsOverrides(overrides);
  const supabase = await createClient();
  const { error } = await supabase.from("lp_site_settings").upsert(
    {
      site_id: siteId ?? (await currentSiteId()),
      key: PLAN_LIMITS_KEY,
      value: JSON.stringify(clean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,key" },
  );

  if (error) {
    console.error("updatePlanLimits error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  revalidateTag("plan-limits", "max");
  revalidatePath("/upgrade");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Plan metadata: what the tiers are CALLED, and which ones a visitor sees     */
/* -------------------------------------------------------------------------- */

/**
 * Names, one-liners and visibility per tier, plus the master switch.
 *
 * Separate from the limits and the prices because it answers a different
 * question — those two say what a tier IS WORTH, this one says what it is CALLED
 * and whether anyone is shown it at all. A storefront can rename Pro to "Sakti"
 * without touching a single number.
 */
const readPlanMeta = unstable_cache(
  async (siteId: string): Promise<PlanMeta> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("lp_site_settings")
        .select("value")
        .eq("site_id", siteId)
        .eq("key", PLAN_META_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_PLAN_META;
      return normalizePlanMeta(JSON.parse(data.value as string));
    } catch {
      // The shipped names and the shipped visibility. A failed read must not
      // silently take a storefront's pricing page off the air.
      return DEFAULT_PLAN_META;
    }
  },
  ["plan-meta"],
  { revalidate: 120, tags: ["plan-meta"] },
);

export async function getPlanMeta(siteId?: string): Promise<PlanMeta> {
  return readPlanMeta(siteId ?? (await currentSiteId()));
}

export async function updatePlanMeta(
  meta: PlanMeta,
  siteId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = normalizePlanMeta(meta);
  const supabase = await createClient();
  const { error } = await supabase.from("lp_site_settings").upsert(
    {
      site_id: siteId ?? (await currentSiteId()),
      key: PLAN_META_KEY,
      value: JSON.stringify(clean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,key" },
  );

  if (error) {
    console.error("updatePlanMeta error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  revalidateTag("plan-meta", "max");
  revalidatePath("/upgrade");
  return { ok: true };
}
