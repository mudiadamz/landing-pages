"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./profiles";
import { normalizeHost, listSites, type Site } from "@/lib/site-resolve";
import { resolveTemplate } from "@/lib/templates/registry";
import { paletteFromKey } from "@/lib/palette";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandMaxBytes, iconShapeError, readPngSize, sniffBrandImage } from "@/lib/site-brand";
import { readWebpHeader } from "@/lib/webp";
import {
  addVercelDomain,
  getVercelDomain,
  verifyVercelDomain,
  removeVercelDomain,
  vercelConfigured,
  type VercelDomainState,
} from "@/lib/vercel-domains";

// Site is deliberately NOT re-exported here. Every export of a "use server"
// module is compiled into a callable server action, and a type re-export becomes
// an action pointing at a symbol that doesn't exist at runtime. Consumers import
// the type from lib/site-resolve.

export type SiteInput = {
  host: string;
  name: string;
  tagline: string;
  description: string;
  categoryIds: string[];
  template: string;
  palette: string;
  /** Public URLs from uploadSiteBrandImage. Empty string clears back to the default. */
  logoUrl: string;
  iconUrl: string;
  active: boolean;
};

/**
 * A hostname, not a URL. Sellers paste "https://resepku.com/" out of habit, and a
 * stored value with a scheme or a trailing slash would never match the Host
 * header — the domain would just silently serve the canonical site forever, which
 * is a miserable thing to debug.
 *
 * Not exported: a "use server" module may only export async functions, since every
 * export becomes a callable server action.
 */
function cleanHost(raw: string): string {
  return normalizeHost(
    (raw ?? "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, ""),
  );
}

/** Rejects what the Host header can never contain. */
function hostError(host: string): string | null {
  if (!host) return "Domain tidak boleh kosong.";
  if (host.length > 253) return "Domain terlalu panjang.";
  if (!/^[a-z0-9.-]+$/.test(host)) return "Domain hanya boleh huruf, angka, titik, dan tanda hubung.";
  if (!host.includes(".")) return "Domain harus punya titik, contoh: resepku.com.";
  if (host.startsWith("-") || host.endsWith("-") || host.startsWith(".") || host.endsWith("."))
    return "Domain tidak boleh diawali/diakhiri titik atau tanda hubung.";
  return null;
}

export async function getSites(): Promise<Site[]> {
  if (!(await requireAdmin())) return [];
  return listSites();
}

/**
 * Upload a storefront's logo or icon.
 *
 * Written with the service role, so requireAdmin() is the whole authorisation —
 * the bucket's own RLS policy keys writes to `auth.uid()/…`, and branding is not
 * one admin's personal folder. It belongs to the domain, so it goes under a
 * `sites/` prefix, and the gate has to be explicit here instead.
 *
 * The path is timestamped rather than derived from the site id, because the form
 * uploads BEFORE the row exists when you are adding a domain. Replacing an image
 * leaves the old object behind, matching uploadPopupImage: an orphaned 8 KB file
 * is cheaper than a delete that races a page still serving the old URL.
 */
export async function uploadSiteBrandImage(
  form: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const kind = form.get("kind") === "icon" ? "icon" : "logo";
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "File tidak ditemukan." };

  const limit = brandMaxBytes(kind);
  if (file.size > limit) {
    return { ok: false, error: `Ukuran maksimal ${Math.round(limit / 1024)} KB — kompres dulu.` };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const bytes = new Uint8Array(buf);
  const sniffed = sniffBrandImage(bytes);
  if (!sniffed) {
    return { ok: false, error: "Format harus PNG, WebP, JPEG, atau SVG asli." };
  }

  if (kind === "icon") {
    if (sniffed.ext === "jpg") {
      return { ok: false, error: "Ikon tidak boleh JPEG — tidak punya transparansi. Pakai PNG atau SVG." };
    }
    // SVG scales, so there is nothing to measure. Raster has to be square and big
    // enough, or the manifest's `sizes: "any"` would be a lie and Chrome would
    // refuse to treat the site as installable.
    if (sniffed.ext !== "svg") {
      const dims = sniffed.ext === "png" ? readPngSize(bytes) : readWebpHeader(buf);
      const shapeErr = iconShapeError(dims);
      if (shapeErr) return { ok: false, error: shapeErr };
    }
  }

  const admin = createAdminClient();
  const path = `sites/${kind}-${Date.now()}.${sniffed.ext}`;
  const { error } = await admin.storage
    .from("landing-assets")
    // The sniffed type, never the declared one: this is the Content-Type the file
    // will be served with from a public bucket.
    .upload(path, bytes, { contentType: sniffed.contentType, upsert: false });
  if (error) {
    console.error("uploadSiteBrandImage error:", error);
    return { ok: false, error: "Gagal mengunggah." };
  }

  const { data } = admin.storage.from("landing-assets").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** Whether the panel can add domains to Vercel itself, or must tell you to. */
export async function isVercelConfigured(): Promise<boolean> {
  if (!(await requireAdmin())) return false;
  return vercelConfigured();
}

export type VercelStatus =
  | { kind: "not-configured" }
  | { kind: "ok"; state: VercelDomainState }
  | { kind: "error"; error: string };

async function toStatus(
  run: () => Promise<
    { ok: true; state: VercelDomainState } | { ok: false; error: string; code?: string }
  >,
): Promise<VercelStatus> {
  const res = await run();
  if (res.ok) return { kind: "ok", state: res.state };
  if (res.code === "not-configured") return { kind: "not-configured" };
  return { kind: "error", error: res.error };
}

/** Read a domain's state on the Vercel project. */
export async function getDomainStatus(host: string): Promise<VercelStatus> {
  if (!(await requireAdmin())) return { kind: "error", error: "Akses ditolak." };
  return toStatus(() => getVercelDomain(host));
}

/** Add (or re-add) the domain to the Vercel project. */
export async function attachDomainToVercel(host: string): Promise<VercelStatus> {
  if (!(await requireAdmin())) return { kind: "error", error: "Akses ditolak." };
  const status = await toStatus(() => addVercelDomain(host));
  revalidatePath("/panel/sites");
  return status;
}

/**
 * Detach from the Vercel project. Explicit only — deleteSite never does this,
 * because a domain that is being re-pointed should keep serving.
 */
export async function detachDomainFromVercel(host: string): Promise<VercelStatus> {
  if (!(await requireAdmin())) return { kind: "error", error: "Akses ditolak." };
  const status = await toStatus(() => removeVercelDomain(host));
  revalidatePath("/panel/sites");
  return status;
}

/** Re-check the DNS challenge once the record has been added at the registrar. */
export async function recheckDomainVerification(host: string): Promise<VercelStatus> {
  if (!(await requireAdmin())) return { kind: "error", error: "Akses ditolak." };
  const status = await toStatus(() => verifyVercelDomain(host));
  revalidatePath("/panel/sites");
  return status;
}

/**
 * Everything that invalidates when a site's identity, niche or template changes.
 *
 * BOTH invalidators, deliberately. Our readers are `unstable_cache` with a `tags`
 * option, and `updateTag` documents its tag sources as fetch tags and `cacheTag()`
 * inside `'use cache'` — not that option. Measured: after a panel save the row in
 * the database and the panel itself said the new template, while the public page
 * kept rendering the old one until a fresh deployment dropped the cache. Five
 * minutes of "I changed it and nothing happened".
 *
 * revalidateTag is the invalidator that pairs with unstable_cache; updateTag is
 * kept for the read-your-own-writes guarantee inside this action's own response.
 */
function bustSiteCaches() {
  for (const tag of ["sites", "homepage-pages"]) {
    // "max" = stale-while-revalidate: at worst the very next request still sees the
    // old value and the one after it is correct. A profile is required in 16.1.6.
    revalidateTag(tag, "max");
    updateTag(tag);
  }
  revalidatePath("/", "layout");
  revalidatePath("/panel/sites");
}

export async function createSite(
  input: SiteInput,
): Promise<{ ok: boolean; error?: string; vercel?: VercelStatus }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const host = cleanHost(input.host);
  const err = hostError(host);
  if (err) return { ok: false, error: err };
  if (!input.name.trim()) return { ok: false, error: "Nama situs tidak boleh kosong." };

  const supabase = await createClient();
  const { error } = await supabase.from("lp_sites").insert({
    host,
    name: input.name.trim(),
    tagline: input.tagline.trim() || null,
    description: input.description.trim() || null,
    category_ids: input.categoryIds,
    template: resolveTemplate(input.template).key,
    palette: paletteFromKey(input.palette).preset,
    logo_url: input.logoUrl?.trim() || null,
    icon_url: input.iconUrl?.trim() || null,
    active: input.active,
    // Never through this form: the canonical site is the one that owns the panel
    // and the payment callback, and having two would be ambiguous.
    is_canonical: false,
  });

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { ok: false, error: `Domain ${host} sudah terdaftar.` };
    }
    console.error("createSite error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  bustSiteCaches();

  // Then hand it to Vercel, if a token is configured. Deliberately AFTER the row
  // exists and never fatal: a Vercel failure must not throw away the site the admin
  // just described, and the panel shows the reason plus a retry button.
  const vercel = await toStatus(() => addVercelDomain(host));
  return { ok: true, vercel };
}

export async function updateSite(
  id: string,
  input: SiteInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const host = cleanHost(input.host);
  const err = hostError(host);
  if (err) return { ok: false, error: err };
  if (!input.name.trim()) return { ok: false, error: "Nama situs tidak boleh kosong." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_sites")
    .update({
      host,
      name: input.name.trim(),
      tagline: input.tagline.trim() || null,
      description: input.description.trim() || null,
      category_ids: input.categoryIds,
      template: resolveTemplate(input.template).key,
      palette: paletteFromKey(input.palette).preset,
      logo_url: input.logoUrl?.trim() || null,
      icon_url: input.iconUrl?.trim() || null,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { ok: false, error: `Domain ${host} sudah dipakai situs lain.` };
    }
    console.error("updateSite error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  bustSiteCaches();
  return { ok: true };
}

/**
 * Deleting a site cascades to its lp_site_settings rows — its hero, popup,
 * tracking id and custom JS go with it. Products are untouched: they belong to
 * categories, not to sites.
 */
export async function deleteSite(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("lp_sites")
    .select("is_canonical")
    .eq("id", id)
    .maybeSingle();
  if (row?.is_canonical) {
    return {
      ok: false,
      error: "Domain utama tidak bisa dihapus — di situlah panel & callback pembayaran berada.",
    };
  }

  const { error } = await supabase.from("lp_sites").delete().eq("id", id);
  if (error) {
    console.error("deleteSite error:", error);
    return { ok: false, error: "Gagal menghapus." };
  }
  bustSiteCaches();
  return { ok: true };
}
