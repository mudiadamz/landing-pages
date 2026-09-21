import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { exportObjects, rewriteUrls } from "../../scripts/storage-migrate.mjs";

/**
 * The cutover tools, run against real data in the local Supabase stack:
 * files put into Supabase Storage must come out byte-identical on disk, and
 * every stored URL — in plain columns, in HTML, in jsonb — must be rewritten
 * so that none still points at the old host.
 */

const API = inject("apiUrl");
const SERVICE = inject("serviceRoleKey");
const DB = inject("dbUrl");
const tag = crypto.randomUUID().slice(0, 8);
const NEW = "https://toko.example";
const sha = (b: Buffer | Uint8Array) => createHash("sha256").update(b).digest("hex");

let root: string;
let raw: pg.Client;
const admin = createClient(API, SERVICE, { auth: { persistSession: false } });
const files = [
  { bucket: "landing-assets", name: `mig-${tag}/cover.png`, body: new Uint8Array(3000).map((_, i) => i % 251), type: "image/png" },
  { bucket: "landing-assets", name: `mig-${tag}/site/deep/style.css`, body: new TextEncoder().encode("body{color:red}"), type: "text/css" },
  { bucket: "landing-downloads", name: `mig-${tag}/p/buku.zip`, body: new Uint8Array(5000).fill(9), type: "application/zip" },
];
let productId: string;
let siteId: string;

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "lp-migrate-"));
  raw = new pg.Client({ connectionString: DB });
  await raw.connect();
  for (const f of files) {
    const { error } = await admin.storage.from(f.bucket).upload(f.name, new Blob([f.body], { type: f.type }), { upsert: true });
    if (error) throw error;
  }
  const old = `${API}/storage/v1/object/public/landing-assets/mig-${tag}`;
  productId = (
    await raw.query(
      "insert into lp_landing_pages (title, slug, thumbnail_url, html_content) values ('m', $1, $2, $3) returning id",
      [`mig-${tag}`, `${old}/cover.png`, `<base href="${old}/site/"><link href="deep/style.css">`],
    )
  ).rows[0].id;
  siteId = (await raw.query("insert into lp_sites (host, name, logo_url) values ($1, 'm', $2) returning id", [`mig-${tag}.test`, `${old}/cover.png`])).rows[0].id;
  await raw.query("insert into lp_site_settings (site_id, key, value) values ($1, 'popup', $2)", [
    siteId,
    JSON.stringify({ image: `${old}/cover.png` }),
  ]);
});

afterAll(async () => {
  await admin.storage.from("landing-assets").remove(files.filter((f) => f.bucket === "landing-assets").map((f) => f.name));
  await admin.storage.from("landing-downloads").remove(files.filter((f) => f.bucket === "landing-downloads").map((f) => f.name));
  await raw.query("delete from lp_landing_pages where id = $1", [productId]);
  await raw.query("delete from lp_sites where id = $1", [siteId]);
  await raw.end();
  rmSync(root, { recursive: true, force: true });
});

describe("export: Supabase Storage → disk", () => {
  it("setiap objek sampai byte-per-byte sama, di layout yang dibaca lib/backend/storage", async () => {
    const report = await exportObjects({ supabaseUrl: API, serviceKey: SERVICE, root, log: () => undefined });
    for (const f of files) {
      const onDisk = readFileSync(path.join(root, f.bucket, ...f.name.split("/")));
      expect(sha(onDisk), f.name).toBe(sha(f.body));
    }
    expect((report as Record<string, { count: number }>)["landing-assets"].count).toBeGreaterThanOrEqual(2);
  });

  it("dijalankan ulang: tidak menyalin apa pun lagi (untuk delta di jendela pemeliharaan)", async () => {
    const again = await exportObjects({ supabaseUrl: API, serviceKey: SERVICE, root, log: () => undefined });
    const copied = Object.values(again as Record<string, { copied: number }>).reduce((s, b) => s + b.copied, 0);
    expect(copied).toBe(0);
  });
});

describe("rewrite: URL lama → host baru", () => {
  it("uji-kering hanya menghitung, tidak mengubah", async () => {
    const { plan, applied } = await rewriteUrls({ db: raw, from: API, to: NEW, log: () => undefined });
    expect(applied).toBe(false);
    const found = (plan as { t: string; c: string }[]).map((p) => `${p.t}.${p.c}`);
    expect(found).toEqual(expect.arrayContaining(["lp_landing_pages.thumbnail_url", "lp_landing_pages.html_content", "lp_sites.logo_url", "lp_site_settings.value"]));
    const still = await raw.query("select thumbnail_url from lp_landing_pages where id = $1", [productId]);
    expect(still.rows[0].thumbnail_url).toContain(API);
  });

  it("--apply menulis ulang kolom biasa, HTML, dan jsonb — dan tidak ada yang tersisa", async () => {
    await rewriteUrls({ db: raw, from: API, to: NEW, apply: true, log: () => undefined });
    const p = (await raw.query("select thumbnail_url, html_content from lp_landing_pages where id = $1", [productId])).rows[0];
    expect(p.thumbnail_url).toBe(`${NEW}/storage/v1/object/public/landing-assets/mig-${tag}/cover.png`);
    expect(p.html_content).toContain(`<base href="${NEW}/storage/v1/object/public/landing-assets/mig-${tag}/site/">`);
    const s = (await raw.query("select value from lp_site_settings where site_id = $1 and key = 'popup'", [siteId])).rows[0];
    expect(JSON.parse(s.value).image).toBe(`${NEW}/storage/v1/object/public/landing-assets/mig-${tag}/cover.png`);
    const again = await rewriteUrls({ db: raw, from: API, to: NEW, log: () => undefined });
    expect(again.plan).toEqual([]);
  });
});
