import { describe, expect, it } from "vitest";
import { as, denied, makeUser, sql } from "./sql";

/**
 * storage.objects policies, one bucket at a time.
 *
 * Every write policy scopes by the first path segment: `<user id>/…`. The
 * sellers' deliverables (landing-downloads) have NO select policy at all — not
 * even for their owner — because the only way a file there should leave the
 * bucket is a signed URL minted by the server after checking a purchase. And
 * publisher-kyc has no policy of any kind: ID photos are service-role only.
 *
 * Deletes are not covered here: storage.objects refuses direct DELETE
 * (trigger protect_objects_delete) — they go through the Storage API, tested
 * over HTTP in storage-http.test.ts.
 */

const put = (who: "anon" | { uid: string }, bucket: string, name: string) =>
  as(who, () => sql("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]));

const visible = async (who: "anon" | { uid: string }, bucket: string, name: string) =>
  (await as(who, () => sql("select 1 from storage.objects where bucket_id = $1 and name = $2", [bucket, name])))
    .rowCount;

const seed = (bucket: string, name: string) =>
  sql("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);

describe("landing-assets — publik, tulis di folder sendiri", () => {
  it("penjual mengunggah ke foldernya; tidak ke folder orang lain; anon tidak mengunggah", async () => {
    const me = await makeUser({ accountType: "agent" });
    const other = await makeUser();
    expect((await put({ uid: me }, "landing-assets", `${me}/a.png`)).rowCount).toBe(1);
    await denied(() => put({ uid: me }, "landing-assets", `${other}/a.png`));
    await denied(() => put("anon", "landing-assets", `${me}/b.png`));
  });

  it("customer biasa tidak bisa mengunggah, bahkan ke foldernya sendiri", async () => {
    // Public bucket, every file type: open to any account it was free hosting
    // on the project's storage domain (20260919070000).
    const me = await makeUser();
    await denied(() => put({ uid: me }, "landing-assets", `${me}/halaman.html`));
    await denied(() => put({ uid: me }, "landing-downloads", `${me}/p/x.zip`));
  });

  it("siapa pun bisa melihat objeknya — ini bucket gambar publik", async () => {
    const me = await makeUser();
    await seed("landing-assets", `${me}/cover.png`);
    expect(await visible("anon", "landing-assets", `${me}/cover.png`)).toBe(1);
  });
});

describe("landing-downloads — file yang dijual", () => {
  it("penjual mengunggah ke foldernya sendiri saja", async () => {
    const me = await makeUser({ accountType: "agent" });
    const other = await makeUser({ accountType: "agent" });
    expect((await put({ uid: me }, "landing-downloads", `${me}/p/buku.epub`)).rowCount).toBe(1);
    await denied(() => put({ uid: me }, "landing-downloads", `${other}/p/buku.epub`));
  });

  it("TIDAK ada yang bisa membaca objeknya lewat API — pemiliknya pun tidak", async () => {
    // The only exit is a server-signed URL after a purchase check
    // (lib/actions/downloads.ts). A select policy here, for anyone, would let
    // a buyer — or a stranger — mint their own.
    const seller = await makeUser({ accountType: "agent" });
    const name = `${seller}/p/buku.epub`;
    await seed("landing-downloads", name);
    for (const who of ["anon", { uid: seller }, { uid: await makeUser() }] as const) {
      expect(await visible(who, "landing-downloads", name), JSON.stringify(who)).toBe(0);
    }
  });
});

describe("chat-attachments — lampiran percakapan", () => {
  it("pemilik mengunggah & melihat miliknya; orang lain tidak melihat; tidak bisa unggah ke folder orang", async () => {
    const me = await makeUser();
    const other = await makeUser();
    const name = `${me}/chat/foto.jpg`;
    expect((await put({ uid: me }, "chat-attachments", name)).rowCount).toBe(1);
    expect(await visible({ uid: me }, "chat-attachments", name)).toBe(1);
    expect(await visible({ uid: other }, "chat-attachments", name)).toBe(0);
    expect(await visible("anon", "chat-attachments", name)).toBe(0);
    await denied(() => put({ uid: other }, "chat-attachments", `${me}/chat/tanam.jpg`));
  });
});

describe("publisher-kyc — foto KTP & selfie", () => {
  it("tidak seorang pun bisa menulis atau membaca lewat API, termasuk pemohonnya sendiri", async () => {
    const me = await makeUser();
    await denied(() => put({ uid: me }, "publisher-kyc", `${me}/ktp.jpg`));
    await seed("publisher-kyc", `${me}/ktp.jpg`);
    const company = await makeUser({ accountType: "company" });
    for (const who of ["anon", { uid: me }, { uid: company }] as const) {
      expect(await visible(who, "publisher-kyc", `${me}/ktp.jpg`), JSON.stringify(who)).toBe(0);
    }
  });
});

describe("storage — daftar policy lengkap", () => {
  it("setiap policy storage.objects menyebut bucket-nya, dan tidak ada yang untuk publisher-kyc", async () => {
    // A policy on storage.objects without a bucket_id condition applies to
    // EVERY bucket — including the KYC one. That is the mistake to catch.
    const { rows } = await sql<{ name: string; expr: string }>(
      `select policyname as name, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
         from pg_policies where schemaname = 'storage' and tablename = 'objects'`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.expr, r.name).toMatch(/bucket_id\s*=\s*'[a-z-]+'/);
      expect(r.expr, r.name).not.toContain("publisher-kyc");
    }
  });
});
