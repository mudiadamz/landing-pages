import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { resetPool } from "@/lib/backend/pool";
import { BUCKETS, signToken, storageClient, type StorageClient } from "@/lib/backend/storage";
import { GET as publicGet } from "@/app/storage/v1/object/public/[bucket]/[...path]/route";
import { GET as signedGet } from "@/app/storage/v1/object/sign/[bucket]/[...path]/route";

/**
 * The storage contract, against the app's own disk storage.
 *
 * Every assertion from storage-http.test.ts (which tested Supabase Storage) is
 * here, run against lib/backend/storage and the /storage/v1/object/* routes —
 * that file tested the old engine, this one the new, and the list of what must
 * hold is the same. Added: what only matters now that files are served from
 * the app's own origin (signature tampering and expiry, path traversal,
 * sandboxed HTML), and range requests, which the PDF viewer and EPUB reader use.
 */

const DB = inject("dbUrl");
const APP_DB = inject("appDbUrl");
let raw: pg.Client;
let root: string;
let sellerId: string;
let customerId: string;
let strangerId: string;

let seller: StorageClient;
let customer: StorageClient;
let stranger: StorageClient;
let service: StorageClient;
let anon: StorageClient;

const bytes = (n: number, type: string) => new Blob([new Uint8Array(n).fill(7)], { type });
const uid = () => crypto.randomUUID();

async function makeUser(standing: "seller" | "customer"): Promise<string> {
  const { rows } = await raw.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, 'x', now(), now(), '{"provider":"email"}', '{}')
     returning id`,
    [`st-${uid().slice(0, 8)}@test.local`],
  );
  // A seller is a business member since Fase 5 (account_type is gone). The
  // storage rules ask lp_can_sell(), which reads that membership.
  if (standing === "seller") {
    const { rows: biz } = await raw.query<{ id: string }>(
      "select id from lp_businesses order by created_at limit 1",
    );
    await raw.query(
      "insert into lp_business_members (business_id, user_id, role) values ($1, $2, 'admin') on conflict do nothing",
      [biz[0].id, rows[0].id],
    );
  }
  return rows[0].id;
}

/** Call a route handler the way Next does. */
const route = (
  handler: (r: Request, c: { params: Promise<{ bucket: string; path: string[] }> }) => Promise<Response>,
  url: string,
  init?: RequestInit,
) => {
  const u = new URL(url, "http://site.test");
  const [, , , , kind, bucket, ...rest] = u.pathname.split("/"); // /storage/v1/object/<kind>/<bucket>/<path…>
  void kind;
  return handler(new Request(u, init), {
    params: Promise.resolve({ bucket, path: rest.map(decodeURIComponent) }),
  });
};
const pub = (bucket: string, name: string, init?: RequestInit) =>
  route(publicGet, `/storage/v1/object/public/${bucket}/${name}`, init);
const signedUrlPath = (u: string) => u.replace("http://site.test", "");

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "lp-storage-"));
  process.env.STORAGE_ROOT = root;
  process.env.STORAGE_SIGNING_SECRET = "uji-".padEnd(48, "x");
  process.env.NEXT_PUBLIC_SITE_URL = "http://site.test";
  await resetPool(APP_DB);
  raw = new pg.Client({ connectionString: DB });
  await raw.connect();
  sellerId = await makeUser("seller");
  customerId = await makeUser("customer");
  strangerId = await makeUser("customer");
  seller = storageClient(() => ({ uid: sellerId }));
  customer = storageClient(() => ({ uid: customerId }));
  stranger = storageClient(() => ({ uid: strangerId }));
  service = storageClient(() => "service_role");
  anon = storageClient(() => "anon");
});

afterAll(async () => {
  await raw.query("delete from auth.users where id = any($1)", [[sellerId, customerId, strangerId]]);
  await raw.end();
  await resetPool();
  rmSync(root, { recursive: true, force: true });
});

describe("konfigurasi bucket", () => {
  it("dipatok — nilainya disalin dari storage.buckets Supabase sebelum dipensiunkan", () => {
    // Was compared against the live storage.buckets table until fase 4 removed
    // it. A change here is a change to what uploads are accepted.
    expect(BUCKETS).toMatchSnapshot();
  });
});

describe("landing-assets — publik, penjual menulis di foldernya", () => {
  it("penjual mengunggah; siapa pun mengambilnya lewat URL publik", async () => {
    const name = `${sellerId}/uji/${uid()}.png`;
    expect((await seller.from("landing-assets").upload(name, bytes(64, "image/png"))).error).toBeNull();
    const res = await pub("landing-assets", name);
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(64);
  });

  it("customer biasa TIDAK bisa mengunggah; anon juga tidak", async () => {
    expect((await customer.from("landing-assets").upload(`${customerId}/h.html`, bytes(8, "text/html"))).error?.statusCode).toBe("403");
    expect((await anon.from("landing-assets").upload(`${customerId}/h.png`, bytes(8, "image/png"))).error).not.toBeNull();
  });

  it("tidak bisa mengunggah ke folder orang lain", async () => {
    expect((await seller.from("landing-assets").upload(`${customerId}/t.png`, bytes(8, "image/png"))).error).not.toBeNull();
  });

  it("pemilik menghapus miliknya; orang lain tidak bisa (diam-diam dilewati)", async () => {
    const name = `${sellerId}/uji/${uid()}.png`;
    await seller.from("landing-assets").upload(name, bytes(8, "image/png"));
    const other = await stranger.from("landing-assets").remove([name]);
    expect(other).toEqual({ data: [], error: null });
    expect((await pub("landing-assets", name)).status).toBe(200);
    expect((await seller.from("landing-assets").remove([name])).data).toHaveLength(1);
    expect((await pub("landing-assets", name)).status).toBe(404);
  });

  it("nama yang sudah ada: tanpa upsert → 409; dengan upsert → ditimpa", async () => {
    const name = `${sellerId}/uji/${uid()}.png`;
    await seller.from("landing-assets").upload(name, bytes(8, "image/png"));
    expect((await seller.from("landing-assets").upload(name, bytes(9, "image/png"))).error?.statusCode).toBe("409");
    expect((await seller.from("landing-assets").upload(name, bytes(10, "image/png"), { upsert: true })).error).toBeNull();
    expect((await (await pub("landing-assets", name)).arrayBuffer()).byteLength).toBe(10);
  });
});

describe("landing-downloads — file yang dijual", () => {
  it("penjual mengunggah ke foldernya; customer tidak bisa", async () => {
    expect((await seller.from("landing-downloads").upload(`${sellerId}/p/${uid()}.zip`, bytes(8, "application/zip"))).error).toBeNull();
    expect((await customer.from("landing-downloads").upload(`${customerId}/p/x.zip`, bytes(8, "application/zip"))).error).not.toBeNull();
  });

  it("tidak bisa diambil lewat API atau URL publik — pemiliknya pun tidak — hanya lewat URL bertanda dari server", async () => {
    const name = `${sellerId}/p/${uid()}.zip`;
    await seller.from("landing-downloads").upload(name, bytes(32, "application/zip"));
    expect((await seller.from("landing-downloads").download(name)).error).not.toBeNull();
    expect((await seller.from("landing-downloads").createSignedUrl(name, 60)).error).not.toBeNull();
    expect((await customer.from("landing-downloads").download(name)).error).not.toBeNull();
    expect((await pub("landing-downloads", name)).status).toBe(404);

    const { data } = await service.from("landing-downloads").createSignedUrl(name, 60);
    const res = await route(signedGet, signedUrlPath(data!.signedUrl));
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(32);
  });

  it("menolak jenis file yang tidak terdaftar", async () => {
    const r = await seller.from("landing-downloads").upload(`${sellerId}/p/x.exe`, bytes(8, "application/x-msdownload"));
    expect(r.error?.statusCode).toBe("415");
  });
});

describe("chat-attachments — lampiran percakapan", () => {
  it("pemilik mengunggah & mengunduh; orang lain tidak bisa mengunduh", async () => {
    const name = `${customerId}/chat/${uid()}.png`;
    expect((await customer.from("chat-attachments").upload(name, bytes(16, "image/png"))).error).toBeNull();
    expect((await customer.from("chat-attachments").download(name)).error).toBeNull();
    expect((await stranger.from("chat-attachments").download(name)).error).not.toBeNull();
  });

  it("menolak di atas 8 MB, dan jenis yang tidak terdaftar", async () => {
    expect((await customer.from("chat-attachments").upload(`${customerId}/chat/b.png`, bytes(9 * 1024 * 1024, "image/png"))).error?.statusCode).toBe("413");
    expect((await customer.from("chat-attachments").upload(`${customerId}/chat/x.exe`, bytes(8, "application/x-msdownload"))).error?.statusCode).toBe("415");
  });
});

describe("publisher-kyc & hiring-cv — hanya server", () => {
  it("publisher-kyc: pemohon pun tidak bisa mengunggah; server bisa, JPEG saja, ≤ 5 MB", async () => {
    expect((await customer.from("publisher-kyc").upload(`${customerId}/ktp.jpg`, bytes(8, "image/jpeg"))).error).not.toBeNull();
    expect((await service.from("publisher-kyc").upload(`${customerId}/ktp-${uid()}.jpg`, bytes(8, "image/jpeg"))).error).toBeNull();
    expect((await service.from("publisher-kyc").upload(`${customerId}/k.png`, bytes(8, "image/png"))).error).not.toBeNull();
    expect((await service.from("publisher-kyc").upload(`${customerId}/b.jpg`, bytes(6 * 1024 * 1024, "image/jpeg"))).error).not.toBeNull();
  });

  it("hiring-cv: server mengunggah PDF; bukan PDF ditolak; tidak ada jalan publik", async () => {
    const name = `${Date.now()}_uji-${uid().slice(0, 6)}.pdf`;
    expect((await service.from("hiring-cv").upload(name, bytes(8, "application/pdf"))).error).toBeNull();
    expect((await service.from("hiring-cv").upload("cv.png", bytes(8, "image/png"))).error).not.toBeNull();
    expect((await pub("hiring-cv", name)).status).toBe(404);
    expect((await customer.from("hiring-cv").download(name)).error).not.toBeNull();
  });
});

describe("URL bertanda — tidak bisa dipalsukan", () => {
  let name: string;
  beforeAll(async () => {
    name = `${sellerId}/p/${uid()}.pdf`;
    await service.from("landing-downloads").upload(name, bytes(100, "application/pdf"));
  });

  it("kedaluwarsa → 403", async () => {
    const past = `${Math.floor(Date.now() / 1000) - 5}.${signToken("landing-downloads", name, 1).split(".")[1]}`;
    expect((await route(signedGet, `/storage/v1/object/sign/landing-downloads/${name}?token=${past}`)).status).toBe(403);
  });

  it("token diubah satu karakter → 403; token milik objek lain → 403; tanpa token → 403", async () => {
    const good = signToken("landing-downloads", name, 60);
    const bad = good.slice(0, -1) + (good.endsWith("A") ? "B" : "A");
    expect((await route(signedGet, `/storage/v1/object/sign/landing-downloads/${name}?token=${bad}`)).status).toBe(403);
    const other = signToken("landing-downloads", `${sellerId}/p/lain.pdf`, 60);
    expect((await route(signedGet, `/storage/v1/object/sign/landing-downloads/${name}?token=${other}`)).status).toBe(403);
    expect((await route(signedGet, `/storage/v1/object/sign/landing-downloads/${name}`)).status).toBe(403);
  });

  it("download= memaksa unduhan dengan nama yang disaring (tanpa injeksi header)", async () => {
    const { data } = await service.from("landing-downloads").createSignedUrl(name, 60, { download: 'a"b\r\nX-Evil: 1.pdf' });
    const res = await route(signedGet, signedUrlPath(data!.signedUrl));
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toMatch(/^attachment; filename="[\w.\- ]+"/);
    expect(cd).not.toMatch(/[\r\n"]X-Evil/);
  });
});

describe("keamanan penyajian dari origin sendiri", () => {
  it("path traversal ditolak di unggah dan di baca", async () => {
    expect((await service.from("landing-assets").upload("../escape.png", bytes(8, "image/png"))).error?.statusCode).toBe("400");
    expect((await service.from("landing-assets").upload(`${sellerId}/../../x.png`, bytes(8, "image/png"))).error?.statusCode).toBe("400");
    const res = await route(publicGet, "/storage/v1/object/public/landing-assets/..%2F..%2Fetc%2Fpasswd");
    expect([400, 404]).toContain(res.status);
  });

  it("HTML & SVG unggahan penjual disajikan ter-sandbox dan nosniff", async () => {
    const html = `${sellerId}/site/${uid()}.html`;
    const svg = `${sellerId}/site/${uid()}.svg`;
    await seller.from("landing-assets").upload(html, new Blob(["<script>1</script>"], { type: "text/html" }));
    await seller.from("landing-assets").upload(svg, new Blob(["<svg/>"], { type: "image/svg+xml" }));
    for (const name of [html, svg]) {
      const res = await pub("landing-assets", name);
      expect(res.headers.get("content-security-policy"), name).toBe("sandbox");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
    const png = `${sellerId}/uji/${uid()}.png`;
    await seller.from("landing-assets").upload(png, bytes(8, "image/png"));
    expect((await pub("landing-assets", png)).headers.get("content-security-policy")).toBeNull();
  });

  it("Range request → 206 dengan byte yang benar; HEAD tanpa body", async () => {
    const name = `${sellerId}/uji/${uid()}.pdf`;
    const content = new Uint8Array(100).map((_, i) => i);
    await seller.from("landing-assets").upload(name, new Blob([content], { type: "application/pdf" }));
    const res = await pub("landing-assets", name, { headers: { range: "bytes=10-19" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 10-19/100");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([...content.slice(10, 20)]);
    const head = await route(publicGet, `/storage/v1/object/public/landing-assets/${name}`, { method: "HEAD" });
    expect(head.headers.get("content-length")).toBe("100");
    expect(await head.text()).toBe("");
  });
});

describe("list — bentuk yang dibaca kode", () => {
  it("file + folder, metadata ukuran, search, urutan", async () => {
    const dir = `${sellerId}/pustaka-${uid().slice(0, 6)}`;
    await seller.from("landing-assets").upload(`${dir}/b.png`, bytes(5, "image/png"));
    await seller.from("landing-assets").upload(`${dir}/a.png`, bytes(7, "image/png"));
    await seller.from("landing-assets").upload(`${dir}/sub/c.png`, bytes(1, "image/png"));
    const { data } = await service.from("landing-assets").list(dir, { sortBy: { column: "name", order: "asc" } });
    expect(data!.map((f) => [f.name, f.id === null, f.metadata?.size ?? null])).toEqual([
      ["a.png", false, 7],
      ["b.png", false, 5],
      ["sub", true, null],
    ]);
    const found = await service.from("landing-assets").list(dir, { search: "b.png" });
    expect(found.data!.map((f) => f.name)).toEqual(["b.png"]);
  });
});
