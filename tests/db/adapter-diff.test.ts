import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { dbClient, type DbClient } from "@/lib/backend/db";
import { resetPool } from "@/lib/backend/pool";
import { resetSchema } from "@/lib/backend/schema";

/**
 * Differential test: the new query engine against PostgREST itself.
 *
 * Every query SHAPE the codebase uses (measured — see
 * docs/plans/remove-supabase.md fase 1) runs twice on the same database, as the
 * same caller: once through supabase-js → PostgREST, once through
 * lib/backend. The answers must be identical — data, count, and error code.
 *
 * This is what lets the 77 files that query the database stay untouched: if
 * the engine answers every shape the way PostgREST did, the call sites cannot
 * tell the difference. It only works while the local Supabase stack still
 * runs; once PostgREST is gone (fase 4) this file retires, and what it proved
 * stays proven by the behaviour tests around it.
 */

const API = inject("apiUrl");
const ANON = inject("anonKey");
const SERVICE = inject("serviceRoleKey");
const DB = inject("dbUrl");
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const tag = crypto.randomUUID().slice(0, 8);
const PASSWORD = "rahasia-uji-123";

let raw: pg.Client;
let admin: SupabaseClient;

// Who is asking, in both worlds.
type Pair = { js: SupabaseClient; ours: DbClient };
let anon: Pair;
let service: Pair;
let customer: Pair; // a signed-in customer who owns chat, reviews, purchases
let agentId: string;
let customerId: string;

const ids = {
  site: "",
  siteB: "",
  products: [] as string[],
  unpublished: "",
  bundle: "",
  session: "",
  message: "",
  attachment: "",
};

async function signedInPair(email: string): Promise<{ pair: Pair; id: string }> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error;
  const login = await createClient(API, ANON, opts).auth.signInWithPassword({ email, password: PASSWORD });
  if (login.error) throw login.error;
  const token = login.data.session!.access_token;
  const js = createClient(API, ANON, { ...opts, global: { headers: { Authorization: `Bearer ${token}` } } });
  return { pair: { js, ours: dbClient(() => ({ uid: data.user!.id })) }, id: data.user.id };
}

beforeAll(async () => {
  await resetPool(DB);
  resetSchema();
  raw = new pg.Client({ connectionString: DB });
  await raw.connect();
  admin = createClient(API, SERVICE, opts);

  anon = { js: createClient(API, ANON, opts), ours: dbClient(() => "anon") };
  service = { js: admin, ours: dbClient(() => "service_role") };

  const agent = await admin.auth.admin.createUser({
    email: `diff-agent-${tag}@test.local`,
    password: PASSWORD,
    email_confirm: true,
  });
  agentId = agent.data.user!.id;
  await raw.query("update lp_profiles set account_type = 'agent' where id = $1", [agentId]);
  ({ pair: customer, id: customerId } = await signedInPair(`diff-cust-${tag}@test.local`));

  const site = await raw.query("insert into lp_sites (host, name) values ($1, 'A') returning id", [`a-${tag}.test`]);
  const siteB = await raw.query("insert into lp_sites (host, name) values ($1, 'B') returning id", [`b-${tag}.test`]);
  ids.site = site.rows[0].id;
  ids.siteB = siteB.rows[0].id;

  // Products with the types that are easy to get subtly wrong: numeric price,
  // bigint view_count, timestamptz, uuid[], nullable text.
  for (let i = 0; i < 5; i++) {
    const r = await raw.query(
      `insert into lp_landing_pages (title, slug, user_id, price, price_discount, is_free, view_count, long_description, published)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true) returning id`,
      [`Buku uji ${tag} ${i}`, `diff-${tag}-${i}`, agentId, 10000 * (i + 1) + 0.5, i === 2 ? null : 5000, i === 0, 1234567890123 + i, i % 2 ? "deskripsi panjang" : null],
    );
    ids.products.push(r.rows[0].id);
  }
  ids.unpublished = (
    await raw.query(
      "insert into lp_landing_pages (title, slug, user_id, published) values ('Draft', $1, $2, false) returning id",
      [`diff-${tag}-draft`, agentId],
    )
  ).rows[0].id;
  ids.bundle = (
    await raw.query(
      "insert into lp_landing_pages (title, slug, user_id, bundle_product_ids) values ('Paket', $1, $2, $3) returning id",
      [`diff-${tag}-bundle`, agentId, [ids.products[0], ids.products[1]]],
    )
  ).rows[0].id;

  await raw.query(
    `insert into lp_purchases (user_id, landing_page_id, amount, payment_method, invoice_number, site_id)
     values ($1, $2, 10000, 'va', $3, $4), ($1, $5, 20000, 'va', $6, null)`,
    [customerId, ids.products[0], `INV-${tag}-1`, ids.site, ids.products[1], `INV-${tag}-2`],
  );
  await raw.query("update lp_purchases set revoked_at = now() where landing_page_id = $1", [ids.products[1]]);
  await raw.query(
    "insert into lp_reviews (user_id, landing_page_id, rating, review_text) values ($1, $2, 5, 'Bagus'), ($1, $3, 4, null)",
    [customerId, ids.products[0], ids.products[1]],
  );
  await raw.query(
    "insert into lp_contacts (name, email, message, site_id) values ('Satu', 's@t', 'a', $1), ('Dua', 'd@t', 'b', null), ('Tiga', 't@t', 'c', $2)",
    [ids.site, ids.siteB],
  );
  ids.session = (
    await raw.query("insert into lp_chat_sessions (user_id, title, site_id) values ($1, 'Sesi', $2) returning id", [
      customerId,
      ids.site,
    ])
  ).rows[0].id;
  ids.message = (
    await raw.query(
      "insert into lp_chat_messages (session_id, user_id, role, content, sources) values ($1, $2, 'user', 'halo', $3) returning id",
      [ids.session, customerId, JSON.stringify([{ url: "https://x.test", title: "X" }])],
    )
  ).rows[0].id;
  await raw.query("insert into lp_chat_messages (session_id, user_id, role, content) values ($1, $2, 'assistant', 'hai')", [
    ids.session,
    customerId,
  ]);
  ids.attachment = (
    await raw.query(
      "insert into lp_chat_attachments (message_id, user_id, name, mime, kind, size, storage_path) values ($1, $2, 'a.png', 'image/png', 'image', 42, $3) returning id",
      [ids.message, customerId, `${customerId}/chat/a.png`],
    )
  ).rows[0].id;
  await raw.query(
    "insert into lp_site_settings (site_id, key, value) values ($1, 'hero', $2), ($1, 'tracking', $3)",
    [ids.site, JSON.stringify({ title: "Halo" }), JSON.stringify({ gtmId: "GTM-X" })],
  );
});

afterAll(async () => {
  await raw.query("delete from lp_contacts where name in ('Satu','Dua','Tiga') and email like '%@t'");
  await raw.query("delete from lp_sites where id = any($1)", [[ids.site, ids.siteB]]);
  for (const id of [agentId, customerId]) if (id) await admin.auth.admin.deleteUser(id);
  await raw.end();
  await resetPool();
});

type Shape = { data: unknown; count: number | null; code: string | null };
const shape = (r: { data: unknown; count?: number | null; error: { code?: string } | null }): Shape => ({
  data: r.data ?? null,
  count: r.count ?? null,
  code: r.error?.code ?? null,
});

/** Run the same query through both engines and demand the same answer. */
async function same(p: Pair, build: (c: any) => PromiseLike<any>) {
  const [a, b] = [shape(await build(p.js)), shape(await build(p.ours))];
  expect(b, "lib/backend harus menjawab persis seperti PostgREST").toEqual(a);
  return a;
}

describe("baca — filter, urutan, halaman", () => {
  it("select kolom + eq + order", async () => {
    const r = await same(anon, (c) =>
      c.from("lp_landing_pages").select("id, slug, title").eq("user_id", agentId).order("slug"),
    );
    expect((r.data as unknown[]).length).toBeGreaterThan(3);
  });

  it("tipe yang mudah meleset: numeric, bigint, timestamptz, uuid[], null", async () => {
    await same(service, (c) =>
      c
        .from("lp_landing_pages")
        .select("slug, price, price_discount, is_free, view_count, created_at, bundle_product_ids, long_description")
        .eq("user_id", agentId)
        .order("slug"),
    );
  });

  it("select * (urutan dan nama kunci ikut dibandingkan)", async () => {
    await same(service, (c) => c.from("lp_landing_pages").select("*").eq("id", ids.products[0]));
  });

  it("alias kolom dan cast", async () => {
    await same(service, (c) => c.from("lp_landing_pages").select("judul:title, harga:price::text").eq("id", ids.products[2]));
  });

  it("order desc + nullsFirst, limit, range", async () => {
    await same(service, (c) =>
      c.from("lp_landing_pages").select("slug, long_description").eq("user_id", agentId).order("long_description", { ascending: false, nullsFirst: false }).order("slug").limit(3),
    );
    await same(service, (c) => c.from("lp_landing_pages").select("slug").eq("user_id", agentId).order("slug").range(1, 3));
  });

  it("in, neq, gte, lt, is, not(is null), contains", async () => {
    await same(service, (c) => c.from("lp_landing_pages").select("slug").in("id", ids.products.slice(0, 3)).order("slug"));
    await same(service, (c) => c.from("lp_landing_pages").select("slug").in("id", []));
    await same(service, (c) => c.from("lp_landing_pages").select("slug").eq("user_id", agentId).neq("is_free", true).order("slug"));
    await same(service, (c) => c.from("lp_landing_pages").select("slug").eq("user_id", agentId).gte("price", 30000).lt("price", 50001).order("slug"));
    await same(service, (c) => c.from("lp_landing_pages").select("slug").eq("user_id", agentId).is("long_description", null).order("slug"));
    await same(service, (c) => c.from("lp_purchases").select("invoice_number").eq("user_id", customerId).not("revoked_at", "is", null));
    await same(service, (c) => c.from("lp_landing_pages").select("slug").contains("bundle_product_ids", [ids.products[0]]));
  });

  it("count exact: head saja, dan bersama data + range", async () => {
    await same(service, (c) => c.from("lp_landing_pages").select("id", { count: "exact", head: true }).eq("user_id", agentId));
    await same(service, (c) =>
      c.from("lp_landing_pages").select("slug", { count: "exact" }).eq("user_id", agentId).order("slug").range(0, 1),
    );
    await same(service, (c) =>
      c.from("lp_purchases").select("id", { count: "exact", head: true }).eq("user_id", customerId).not("revoked_at", "is", null),
    );
  });
});

describe("baca — .or() seperti yang dipakai kode", () => {
  it("lingkup situs (site-scope): situs kanonik + tanpa atribusi", async () => {
    await same(service, (c) =>
      c.from("lp_contacts").select("name").or(`site_id.eq.${ids.site},site_id.is.null`).in("name", ["Satu", "Dua", "Tiga"]).order("name"),
    );
    await same(service, (c) =>
      c.from("lp_contacts").select("name").or(`site_id.eq.${ids.siteB}`).in("name", ["Satu", "Dua", "Tiga"]).order("name"),
    );
  });

  it("ALL_SITES dengan negasi (site_id.not.is.null)", async () => {
    await same(service, (c) =>
      c.from("lp_contacts").select("name").or("site_id.is.null,site_id.not.is.null").in("name", ["Satu", "Dua", "Tiga"]).order("name"),
    );
  });

  it("pencarian ilike di dua kolom", async () => {
    await same(anon, (c) =>
      c.from("lp_landing_pages").select("slug").or(`title.ilike.%${tag} 3%,long_description.ilike.%panjang%`).eq("user_id", agentId).order("slug"),
    );
  });

  it("kunci jawaban MbahGPT: is.null ATAU lt.<timestamp>", async () => {
    const stale = new Date(Date.now() + 60_000).toISOString();
    await same(customer, (c) =>
      c.from("lp_chat_sessions").select("id").eq("id", ids.session).or(`answering_at.is.null,answering_at.lt.${stale}`),
    );
  });
});

describe("baca — relasi (embed)", () => {
  it("many-to-one: ulasan + produknya, dengan not(review_text is null)", async () => {
    await same(anon, (c) =>
      c.from("lp_reviews").select("id, rating, review_text, created_at, lp_landing_pages(slug, title, published)").eq("user_id", customerId).not("review_text", "is", null),
    );
  });

  it("alias + petunjuk FK: pembelian → landing_pages:lp_landing_pages!purchases_landing_page_id_fkey", async () => {
    await same(customer, (c) =>
      c
        .from("lp_purchases")
        .select(`id, landing_page_id, purchased_at, bundle_parent_id,
                 landing_pages:lp_landing_pages!purchases_landing_page_id_fkey (title, slug, zip_url, thumbnail_url)`)
        .eq("user_id", customerId)
        .order("purchased_at", { ascending: false }),
    );
  });

  it("one-to-many: pesan + lampirannya (jsonb sources ikut)", async () => {
    await same(customer, (c) =>
      c.from("lp_chat_messages").select("id, role, content, sources, lp_chat_attachments(id, name, mime, size, storage_path)").eq("session_id", ids.session).order("created_at").order("id"),
    );
  });

  it("embed count: sesi + jumlah pesannya", async () => {
    await same(customer, (c) =>
      c.from("lp_chat_sessions").select("id, title, updated_at, answering_at, lp_chat_messages(count)").eq("user_id", customerId),
    );
  });

  it("!inner dengan filter di kolom embed", async () => {
    await same(customer, (c) =>
      c.from("lp_chat_attachments").select("storage_path, lp_chat_messages!inner(session_id)").eq("lp_chat_messages.session_id", ids.session),
    );
    await same(customer, (c) =>
      c.from("lp_chat_attachments").select("storage_path, lp_chat_messages!inner(session_id)").eq("lp_chat_messages.session_id", crypto.randomUUID()),
    );
  });
});

describe("baca — single, maybeSingle, RLS", () => {
  it("single: satu baris → objek; nol baris → PGRST116", async () => {
    await same(anon, (c) => c.from("lp_sites").select("id, host").eq("id", ids.site).single());
    await same(anon, (c) => c.from("lp_sites").select("id").eq("id", crypto.randomUUID()).single());
  });

  it("maybeSingle: nol → null tanpa error; lebih dari satu → PGRST116", async () => {
    await same(anon, (c) => c.from("lp_sites").select("id").eq("id", crypto.randomUUID()).maybeSingle());
    await same(service, (c) => c.from("lp_landing_pages").select("id").eq("user_id", agentId).maybeSingle());
    await same(anon, (c) => c.from("lp_site_settings").select("value").eq("site_id", ids.site).eq("key", "hero").maybeSingle());
  });

  it("RLS berlaku sama: anon tidak melihat profil; customer tidak melihat pembelian yang dicabut", async () => {
    await same(anon, (c) => c.from("lp_profiles").select("id").eq("id", customerId));
    await same(customer, (c) => c.from("lp_purchases").select("invoice_number").eq("user_id", customerId).order("invoice_number"));
    await same(customer, (c) => c.from("lp_profiles").select("id, full_name, account_type").eq("id", customerId).single());
  });
});

describe("tulis", () => {
  it("insert + select + single, lalu delete + select", async () => {
    for (const p of [customer.js, customer.ours] as any[]) {
      const ins = shape(
        await p.from("lp_product_likes").insert({ user_id: customerId, landing_page_id: ids.products[3] }).select("user_id, landing_page_id").single(),
      );
      expect(ins).toEqual({ data: { user_id: customerId, landing_page_id: ids.products[3] }, count: null, code: null });
      const del = shape(await p.from("lp_product_likes").delete().eq("landing_page_id", ids.products[3]).select("landing_page_id"));
      expect(del).toEqual({ data: [{ landing_page_id: ids.products[3] }], count: null, code: null });
    }
  });

  it("insert tanpa select → data null; penolakan RLS → 42501 di keduanya", async () => {
    for (const p of [customer.js, customer.ours] as any[]) {
      const r = shape(await p.from("lp_landing_pages").insert({ title: "x", slug: `diff-${tag}-evil`, user_id: customerId }));
      expect(r.code).toBe("42501");
    }
  });

  it("update + select (tanpa select → null), kunci undefined tidak menyentuh kolom", async () => {
    for (const p of [service.js, service.ours] as any[]) {
      // Same starting row for both engines.
      await raw.query("update lp_landing_pages set long_description = null where id = $1", [ids.products[4]]);
      const none = shape(await p.from("lp_landing_pages").update({ title: "Diubah" }).eq("id", ids.products[4]));
      expect(none).toEqual({ data: null, count: null, code: null });
      const r = shape(
        await p.from("lp_landing_pages").update({ title: "Diubah lagi", long_description: undefined }).eq("id", ids.products[4]).select("title, long_description"),
      );
      expect(r).toEqual({ data: [{ title: "Diubah lagi", long_description: null }], count: null, code: null });
      await p.from("lp_landing_pages").update({ long_description: "tetap" }).eq("id", ids.products[4]);
      await p.from("lp_landing_pages").update({ title: "t", long_description: undefined }).eq("id", ids.products[4]);
      const after = await raw.query("select long_description from lp_landing_pages where id = $1", [ids.products[4]]);
      expect(after.rows[0].long_description).toBe("tetap");
    }
  });

  it("upsert onConflict (setelan situs) dan ignoreDuplicates", async () => {
    for (const p of [service.js, service.ours] as any[]) {
      const r = shape(
        await p.from("lp_site_settings").upsert({ site_id: ids.site, key: "tracking", value: JSON.stringify({ gtmId: "GTM-Y" }) }, { onConflict: "site_id,key" }).select("key, value").single(),
      );
      expect(r).toEqual({ data: { key: "tracking", value: JSON.stringify({ gtmId: "GTM-Y" }) }, count: null, code: null });
      const ig = shape(
        await p.from("lp_site_settings").upsert({ site_id: ids.site, key: "tracking", value: "{}" }, { onConflict: "site_id,key", ignoreDuplicates: true }),
      );
      expect(ig.code).toBeNull();
      const now = await raw.query("select value from lp_site_settings where site_id = $1 and key = 'tracking'", [ids.site]);
      expect(now.rows[0].value).toBe(JSON.stringify({ gtmId: "GTM-Y" }));
    }
  });

  it("pelanggaran unik → 23505 di keduanya (yang dicek kode)", async () => {
    for (const p of [service.js, service.ours] as any[]) {
      const r = shape(await p.from("lp_purchases").insert({ user_id: customerId, landing_page_id: ids.products[0], amount: 0 }));
      expect(r.code).toBe("23505");
    }
  });

  it("rpc void: lp_increment_view dari anon", async () => {
    const slug = `diff-${tag}-0`;
    const before = Number((await raw.query("select view_count from lp_landing_pages where slug = $1", [slug])).rows[0].view_count);
    const a = shape(await anon.js.rpc("lp_increment_view", { p_slug: slug }));
    const b = shape(await anon.ours.rpc("lp_increment_view", { p_slug: slug }));
    expect(b).toEqual(a);
    const after = Number((await raw.query("select view_count from lp_landing_pages where slug = $1", [slug])).rows[0].view_count);
    expect(after).toBe(before + 2);
  });
});
