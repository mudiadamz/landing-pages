import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

/**
 * Storage over HTTP, against the local Storage API.
 *
 * Size limits and allowed MIME types are enforced by the Storage API, not by
 * Postgres, so the SQL-level tests (rls-storage.test.ts) cannot see them. Nor
 * can they delete: storage.objects refuses direct DELETE. Both live here.
 *
 * Objects and users created here are committed and removed in afterAll.
 */

const API = inject("apiUrl");
const ANON = inject("anonKey");
const SERVICE = inject("serviceRoleKey");
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(API, SERVICE, opts);

const PASSWORD = "rahasia-uji-123";
const users: string[] = [];
const objects: { bucket: string; path: string }[] = [];

async function signedIn(accountType: "customer" | "agent" = "customer"): Promise<{ id: string; sb: SupabaseClient }> {
  const email = `t-${crypto.randomUUID().slice(0, 8)}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error;
  users.push(data.user.id);
  if (accountType !== "customer") {
    await admin.from("lp_profiles").update({ account_type: accountType }).eq("id", data.user.id);
  }
  const sb = createClient(API, ANON, opts);
  const { error: e2 } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  return { id: data.user.id, sb };
}

// The Blob's own type is what storage-js sends for a Blob body — the
// `contentType` option is ignored for it — so an untyped Blob arrives as
// application/octet-stream and every MIME test would be testing that instead.
const bytes = (n: number, type: string) => new Blob([new Uint8Array(n)], { type });
const track = (bucket: string, path: string) => (objects.push({ bucket, path }), path);

const put = (sb: SupabaseClient, bucket: string, path: string, size = 64, contentType = "image/png") =>
  sb.storage.from(bucket).upload(track(bucket, path), bytes(size, contentType), { contentType, upsert: false });

const publicGet = (bucket: string, path: string) => fetch(`${API}/storage/v1/object/public/${bucket}/${path}`);

let seller: { id: string; sb: SupabaseClient };
let customer: { id: string; sb: SupabaseClient };

beforeAll(async () => {
  seller = await signedIn("agent");
  customer = await signedIn();
});

afterAll(async () => {
  const byBucket = new Map<string, string[]>();
  for (const o of objects) byBucket.set(o.bucket, [...(byBucket.get(o.bucket) ?? []), o.path]);
  for (const [bucket, paths] of byBucket) await admin.storage.from(bucket).remove(paths);
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

describe("konfigurasi bucket", () => {
  it("kelima bucket ada, dengan visibilitas, batas ukuran, dan jenis file yang tertulis", async () => {
    const { data, error } = await admin.storage.listBuckets();
    expect(error).toBeNull();
    const shape = Object.fromEntries(
      (data ?? []).map((b) => [
        b.id,
        { public: b.public, limit: b.file_size_limit ?? null, mime: b.allowed_mime_types ?? null },
      ]),
    );
    expect(shape).toEqual({
      "landing-assets": { public: true, limit: 52428800, mime: null },
      "landing-downloads": {
        public: false,
        limit: 52428800,
        mime: ["application/zip", "application/x-zip-compressed", "application/pdf", "application/epub+zip"],
      },
      "publisher-kyc": { public: false, limit: 5242880, mime: ["image/jpeg"] },
      "chat-attachments": { public: false, limit: 8388608, mime: expect.arrayContaining(["image/png", "application/pdf"]) },
      // Created by hand in production and missing from every migration until
      // 20260919060000 — /api/hiring-test failed on any database built from them.
      "hiring-cv": { public: false, limit: 5242880, mime: ["application/pdf"] },
    });
  });
});

describe("landing-assets — gambar & bundle situs, publik", () => {
  it("penjual mengunggah ke foldernya, dan siapa pun bisa mengambilnya lewat URL publik", async () => {
    const path = `${seller.id}/uji/${crypto.randomUUID()}.png`;
    expect((await put(seller.sb, "landing-assets", path)).error).toBeNull();
    expect((await publicGet("landing-assets", path)).status).toBe(200);
  });

  it("customer biasa TIDAK bisa mengunggah — bucket publik, semua jenis file, 50 MB", async () => {
    // Allowing every MIME type is deliberate (site bundles carry HTML/CSS/JS),
    // which is exactly why the writer has to be a seller: open to any account,
    // this was free hosting for phishing pages on the project's storage domain.
    const res = await put(customer.sb, "landing-assets", `${customer.id}/halaman.html`, 64, "text/html");
    expect(res.error).not.toBeNull();
  });

  it("tidak bisa mengunggah ke folder orang lain", async () => {
    const res = await put(seller.sb, "landing-assets", `${customer.id}/tanam.png`);
    expect(res.error).not.toBeNull();
  });

  it("pemilik bisa menghapus miliknya; orang lain tidak", async () => {
    const path = `${seller.id}/uji/${crypto.randomUUID()}.png`;
    await put(seller.sb, "landing-assets", path);
    const other = await signedIn("agent");
    await other.sb.storage.from("landing-assets").remove([path]);
    expect((await publicGet("landing-assets", path)).status, "masih ada setelah dihapus orang lain").toBe(200);
    await seller.sb.storage.from("landing-assets").remove([path]);
    expect((await publicGet("landing-assets", path)).status, "hilang setelah dihapus pemiliknya").not.toBe(200);
  });
});

describe("landing-downloads — file yang dijual", () => {
  it("penjual mengunggah ke foldernya; customer tidak bisa", async () => {
    const path = `${seller.id}/p/${crypto.randomUUID()}.zip`;
    expect((await put(seller.sb, "landing-downloads", path, 64, "application/zip")).error).toBeNull();
    const res = await put(customer.sb, "landing-downloads", `${customer.id}/p/x.zip`, 64, "application/zip");
    expect(res.error).not.toBeNull();
  });

  it("tidak bisa diunduh lewat API atau URL publik — pemiliknya pun tidak — hanya lewat signed URL dari server", async () => {
    const path = `${seller.id}/p/${crypto.randomUUID()}.zip`;
    await put(seller.sb, "landing-downloads", path, 64, "application/zip");

    expect((await seller.sb.storage.from("landing-downloads").download(path)).error).not.toBeNull();
    expect((await seller.sb.storage.from("landing-downloads").createSignedUrl(path, 60)).error).not.toBeNull();
    expect((await customer.sb.storage.from("landing-downloads").download(path)).error).not.toBeNull();
    expect((await publicGet("landing-downloads", path)).status).not.toBe(200);

    // The one way out: what lib/actions/downloads.ts does after a purchase check.
    const { data } = await admin.storage.from("landing-downloads").createSignedUrl(path, 60);
    expect((await fetch(data!.signedUrl)).status).toBe(200);
  });

  it("menolak jenis file yang tidak terdaftar", async () => {
    const res = await put(seller.sb, "landing-downloads", `${seller.id}/p/x.exe`, 64, "application/x-msdownload");
    expect(res.error).not.toBeNull();
  });
});

describe("chat-attachments — lampiran percakapan", () => {
  it("pemilik mengunggah & mengunduh miliknya; orang lain tidak bisa mengunduh", async () => {
    const path = `${customer.id}/chat/${crypto.randomUUID()}.png`;
    expect((await put(customer.sb, "chat-attachments", path)).error).toBeNull();
    expect((await customer.sb.storage.from("chat-attachments").download(path)).error).toBeNull();
    const stranger = await signedIn();
    expect((await stranger.sb.storage.from("chat-attachments").download(path)).error).not.toBeNull();
  });

  it("menolak file di atas 8 MB", async () => {
    const res = await put(customer.sb, "chat-attachments", `${customer.id}/chat/besar.png`, 9 * 1024 * 1024);
    expect(res.error).not.toBeNull();
  });

  it("menolak jenis file yang tidak terdaftar", async () => {
    const res = await put(
      customer.sb,
      "chat-attachments",
      `${customer.id}/chat/x.exe`,
      64,
      "application/x-msdownload",
    );
    expect(res.error).not.toBeNull();
  });
});

describe("publisher-kyc — foto KTP & selfie", () => {
  it("pemohon sendiri pun tidak bisa mengunggah lewat API; server bisa, JPEG saja, ≤ 5 MB", async () => {
    expect((await put(customer.sb, "publisher-kyc", `${customer.id}/ktp.jpg`, 64, "image/jpeg")).error).not.toBeNull();
    const ok = await put(admin, "publisher-kyc", `${customer.id}/ktp-${crypto.randomUUID()}.jpg`, 64, "image/jpeg");
    expect(ok.error).toBeNull();
    expect((await put(admin, "publisher-kyc", `${customer.id}/ktp.png`, 64, "image/png")).error).not.toBeNull();
    expect(
      (await put(admin, "publisher-kyc", `${customer.id}/besar.jpg`, 6 * 1024 * 1024, "image/jpeg")).error,
    ).not.toBeNull();
  });
});

describe("hiring-cv — CV pelamar", () => {
  it("server mengunggah PDF; bukan PDF ditolak; tidak ada jalan publik ke isinya", async () => {
    const path = `${Date.now()}_uji-${crypto.randomUUID().slice(0, 6)}.pdf`;
    expect((await put(admin, "hiring-cv", path, 64, "application/pdf")).error).toBeNull();
    expect((await put(admin, "hiring-cv", "cv.png", 64, "image/png")).error).not.toBeNull();
    expect((await publicGet("hiring-cv", path)).status).not.toBe(200);
    expect((await customer.sb.storage.from("hiring-cv").download(path)).error).not.toBeNull();
  });
});
