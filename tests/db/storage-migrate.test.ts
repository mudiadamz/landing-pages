import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { exportObjects, rewriteUrls } from "../../scripts/storage-migrate.mjs";

/**
 * The cutover tools: files in Supabase Storage must come out byte-identical on
 * disk, and every stored URL — in plain columns, in HTML, in JSON text — must
 * be rewritten so that none still points at the old host.
 *
 * Supabase Storage is played by a small HTTP server speaking the three
 * endpoints `export` uses (bucket list, paged object list with folders, object
 * download), in the shapes storage-api v1 returns. It was first run against the
 * real storage-api of the local Supabase stack (commit 72221ce); the fake keeps
 * the test alive now that the stack is gone.
 */

const DB = inject("dbUrl");
const SERVICE = "kunci-service-uji";
let API: string;
let fake: Server;
const tag = crypto.randomUUID().slice(0, 8);
const NEW = "https://toko.example";
const sha = (b: Buffer | Uint8Array) => createHash("sha256").update(b).digest("hex");

let root: string;
let raw: pg.Client;

/** storage-api, as much of it as `export` touches. Pages of 1000, like the real one. */
function fakeStorage(objects: { bucket: string; name: string; body: Uint8Array }[]): Server {
  return createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${SERVICE}`) return res.writeHead(401).end();
    const url = new URL(req.url!, "http://x");
    const json = (v: unknown) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(v));
    if (url.pathname === "/storage/v1/bucket") {
      return json([...new Set(objects.map((o) => o.bucket))].map((id) => ({ id, name: id })));
    }
    const list = url.pathname.match(/^\/storage\/v1\/object\/list\/([^/]+)$/);
    if (list && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { prefix = "", limit, offset } = JSON.parse(body);
      const base = prefix ? `${prefix}/` : "";
      const seen = new Map<string, object>();
      for (const o of objects.filter((o) => o.bucket === list[1] && o.name.startsWith(base))) {
        const rest = o.name.slice(base.length);
        const [head, ...tail] = rest.split("/");
        if (tail.length) seen.set(head, { name: head, id: null, metadata: null });
        else seen.set(head, { name: head, id: crypto.randomUUID(), metadata: { size: o.body.byteLength } });
      }
      const items = [...seen.values()].sort((a, b) => ((a as { name: string }).name < (b as { name: string }).name ? -1 : 1));
      return json(items.slice(offset, offset + limit));
    }
    const get = url.pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (get && req.method === "GET") {
      const name = get[2].split("/").map(decodeURIComponent).join("/");
      const o = objects.find((o) => o.bucket === get[1] && o.name === name);
      return o ? res.writeHead(200).end(Buffer.from(o.body)) : res.writeHead(404).end();
    }
    res.writeHead(404).end();
  });
}
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
  // Enough objects in one folder to need a second page of the listing.
  const many = Array.from({ length: 1005 }, (_, i) => ({
    bucket: "landing-assets",
    name: `mig-${tag}/banyak/${String(i).padStart(4, "0")}.txt`,
    body: new TextEncoder().encode(`isi ${i}`),
  }));
  fake = fakeStorage([...files, ...many]);
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", r));
  API = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
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
  await new Promise((r) => fake.close(r));
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
    expect((report as Record<string, { count: number }>)["landing-assets"].count).toBe(2 + 1005);
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
