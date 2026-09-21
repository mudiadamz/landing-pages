"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";
import {
  PANEL_SITE_COOKIE,
  PANEL_SITE_COOKIE_MAX_AGE,
  PANEL_SITE_COOKIE_PATH,
} from "@/lib/panel-site";
import { requireAdmin } from "./profiles";
import { normalizeHost, listSites, type Site } from "@/lib/site-resolve";
import { resolveTemplate } from "@/lib/templates/registry";
import { paletteFromKey } from "@/lib/palette";
import { normalizeLocale } from "@/lib/i18n";
import { createAdminClient } from "@/lib/db/admin";
import { brandMaxBytes, iconShapeError, readPngSize, sniffBrandImage } from "@/lib/site-brand";
import { readWebpHeader } from "@/lib/webp";

// Site is deliberately NOT re-exported here. Every export of a "use server"
// module is compiled into a callable server action, and a type re-export becomes
// an action pointing at a symbol that doesn't exist at runtime. Consumers import
// the type from lib/site-resolve.

/**
 * The two halves of a site row, deliberately kept apart.
 *
 * They are different jobs with different risks. Changing the HOST means DNS and
 * the TLS gate that reads this row — get it wrong and the storefront is
 * unreachable, or silently serves the canonical site forever. Changing the NAME or
 * the palette is copy and styling: reversible, frequent, and nobody has to touch
 * an external dashboard.
 *
 * One combined form made every rename look like an infrastructure change, and made
 * every "just fix the logo" edit re-submit the host field. Two inputs, two actions,
 * two screens — /panel/sites for the plumbing, /panel/branding for the content.
 */
export type SiteDomainInput = {
  host: string;
  active: boolean;
};

export type SiteProfileInput = {
  name: string;
  tagline: string;
  description: string;
  categoryIds: string[];
  template: string;
  palette: string;
  /** UI language for this storefront. Anything unknown falls back to Indonesian. */
  locale: string;
  /** Public URLs from uploadSiteBrandImage. Empty string clears back to the default. */
  logoUrl: string;
  iconUrl: string;
};

/** Creating a domain asks the minimum: where it lives and what to call it. */
export type SiteCreateInput = {
  host: string;
  name: string;
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
 * Point the whole panel at a storefront — the sidebar switcher, and the only way the
 * scope changes.
 *
 * The id is validated here as well as in editingSite(). Not redundant: this is where a
 * bad value would be PERSISTED for a year, and refusing to store it is better than
 * storing it and relying on every reader to shrug it off.
 *
 * requireAdmin because only admins reach the per-site screens at all. The cookie grants
 * nothing on its own — it selects a scope, and every write behind it still has its own
 * gate — but a cookie no one can act on has no business being set either.
 */
export async function selectPanelSite(siteId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const all = await listSites();
  const target = all.find((s) => s.id === siteId);
  if (!target) return { ok: false, error: "Situs tidak ditemukan." };

  (await cookies()).set(PANEL_SITE_COOKIE, target.id, {
    path: PANEL_SITE_COOKIE_PATH,
    maxAge: PANEL_SITE_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // The layout renders the switcher and every per-site screen reads the scope, so the
  // whole panel subtree is stale — not just the page that called this.
  revalidatePath("/panel", "layout");
  return { ok: true };
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

/**
 * Sejak repo ini pindah dari Vercel ke Docker + Caddy, panel tidak lagi
 * "mendaftarkan" domain ke mana pun.
 *
 * Yang dulu ada di sini — tambah/hapus/verifikasi domain lewat API Vercel —
 * hilang bersama layanannya. Penggantinya bukan API lain: Caddy menerbitkan
 * sertifikat sendiri saat permintaan pertama untuk sebuah domain datang, dan
 * yang menentukan boleh-tidaknya adalah baris di `lp_sites` ini juga (lihat
 * app/api/tls-check). Jadi menyimpan barisnya DAN mengarahkan DNS-nya memang
 * sudah seluruh prosedurnya.
 *
 * Satu hal yang benar-benar hilang: tombol "cek status verifikasi". Vercel
 * punya jawabannya karena dia yang memegang domainnya; sekarang jawabannya ada
 * di DNS, dan `dig` lebih jujur daripada tombol yang menebak.
 */

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
  input: SiteCreateInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const host = cleanHost(input.host);
  const err = hostError(host);
  if (err) return { ok: false, error: err };
  if (!input.name.trim()) return { ok: false, error: "Nama situs tidak boleh kosong." };

  const db = await createClient();
  // Host and name only. Everything else takes its column default, and the admin is
  // sent to /panel/branding to choose it — a new domain is unreachable for as long
  // as DNS takes anyway, so there is nothing gained by demanding its palette first.
  const { data, error } = await db
    .from("lp_sites")
    .insert({
      host,
      name: input.name.trim(),
      // Never through this form: the canonical site is the one that owns the panel
      // and the payment callback, and having two would be ambiguous.
      is_canonical: false,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { ok: false, error: `Domain ${host} sudah terdaftar.` };
    }
    console.error("createSite error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  bustSiteCaches();

  // Tidak ada langkah kedua. Barisnya ada = domainnya sah; Caddy menanyakan
  // baris ini lewat /api/tls-check sebelum menerbitkan sertifikat, jadi sisanya
  // tinggal mengarahkan DNS.
  return { ok: true, id: data?.id };
}

/**
 * The plumbing half: where the domain lives and whether it is switched on.
 *
 * Nothing here is cosmetic, which is the point of it being its own action — an
 * accidental host edit takes a live storefront off the air, so it should not ride
 * along with a logo change.
 */
export async function updateSiteDomain(
  id: string,
  input: SiteDomainInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const host = cleanHost(input.host);
  const err = hostError(host);
  if (err) return { ok: false, error: err };

  const db = await createClient();
  const { data: row } = await db
    .from("lp_sites")
    .select("host, is_canonical")
    .eq("id", id)
    .maybeSingle();

  // The canonical host is the Duitku callback origin and the one host in Supabase's
  // redirect allowlist. Renaming it from a form would break payment confirmation and
  // every Google sign-in at once, so it is refused here as well as disabled in the UI.
  if (row?.is_canonical && host !== row.host) {
    return {
      ok: false,
      error: "Domain utama tidak bisa diganti di sini — callback pembayaran & login terikat ke host ini.",
    };
  }

  const { error } = await db
    .from("lp_sites")
    .update({ host, active: input.active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { ok: false, error: `Domain ${host} sudah dipakai situs lain.` };
    }
    console.error("updateSiteDomain error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  bustSiteCaches();
  return { ok: true };
}

/**
 * The content half: name, tagline, search snippet, logo, icon, template, palette,
 * language and which slice of the catalog this storefront shows.
 *
 * Never touches `host` or `active`, so saving the copy cannot take a domain down.
 */
export async function updateSiteProfile(
  id: string,
  input: SiteProfileInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };
  if (!input.name.trim()) return { ok: false, error: "Nama situs tidak boleh kosong." };

  const db = await createClient();
  const { error } = await db
    .from("lp_sites")
    .update({
      name: input.name.trim(),
      tagline: input.tagline.trim() || null,
      description: input.description.trim() || null,
      category_ids: input.categoryIds,
      template: resolveTemplate(input.template).key,
      palette: paletteFromKey(input.palette).preset,
      locale: normalizeLocale(input.locale),
      logo_url: input.logoUrl?.trim() || null,
      icon_url: input.iconUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("updateSiteProfile error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  bustSiteCaches();
  revalidatePath("/panel/branding");
  return { ok: true };
}

/**
 * Deleting a site cascades to its lp_site_settings rows — its hero, popup,
 * tracking id and custom JS go with it. Products are untouched: they belong to
 * categories, not to sites.
 */
export async function deleteSite(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const db = await createClient();
  const { data: row } = await db
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

  const { error } = await db.from("lp_sites").delete().eq("id", id);
  if (error) {
    console.error("deleteSite error:", error);
    return { ok: false, error: "Gagal menghapus." };
  }
  bustSiteCaches();
  return { ok: true };
}
