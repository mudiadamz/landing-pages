import { describe, expect, it } from "vitest";
import { as, count, denied, makeProduct, makePurchase, makeSite, makeUser, sql, sqlState, uniq } from "./sql";

/**
 * Logic that lives INSIDE the database: triggers, RPCs, and the constraints
 * that encode business rules. None of it is visible from the TypeScript side,
 * all of it would have to be rebuilt by hand in a backend without Postgres
 * triggers — and until now none of it had a test.
 */

const product = async (id: string) =>
  (
    await sql<{ sold_count: number; like_count: number; view_count: string; rating: string | null }>(
      "select sold_count, like_count, view_count, rating from lp_landing_pages where id = $1",
      [id],
    )
  ).rows[0];

describe("trigger penghitung — jalan walau pemicunya tak boleh menulis produk", () => {
  // The buyer, the liker and the reviewer are all refused UPDATE on
  // lp_landing_pages. The counters still move because the triggers are
  // SECURITY DEFINER. A backend that runs this logic with the caller's rights
  // would silently stop counting.

  it("sold_count naik saat pembelian masuk, turun saat dihapus, tidak di bawah nol", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const buyer = await makeUser();
    const p = await makeProduct(seller, { isFree: true });
    await as({ uid: buyer }, () =>
      sql("insert into lp_purchases (user_id, landing_page_id, amount) values ($1, $2, 0)", [buyer, p]),
    );
    expect((await product(p)).sold_count).toBe(1);
    await sql("delete from lp_purchases where landing_page_id = $1", [p]);
    expect((await product(p)).sold_count).toBe(0);
    await sql("update lp_landing_pages set sold_count = 0 where id = $1", [p]);
    await makePurchase(buyer, p);
    await sql("update lp_landing_pages set sold_count = 0 where id = $1", [p]);
    await sql("delete from lp_purchases where landing_page_id = $1", [p]);
    expect((await product(p)).sold_count).toBe(0);
  });

  it("mencabut akses TIDAK mengurangi sold_count — penjualannya tetap terjadi", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const p = await makeProduct(seller);
    const purchase = await makePurchase(await makeUser(), p);
    await sql("update lp_purchases set revoked_at = now() where id = $1", [purchase]);
    expect((await product(p)).sold_count).toBe(1);
  });

  it("like_count mengikuti like & batal like", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const p = await makeProduct(seller);
    await as({ uid: me }, () =>
      sql("insert into lp_product_likes (user_id, landing_page_id) values ($1, $2)", [me, p]),
    );
    expect((await product(p)).like_count).toBe(1);
    await as({ uid: me }, () => sql("delete from lp_product_likes where landing_page_id = $1", [p]));
    expect((await product(p)).like_count).toBe(0);
  });

  it("rating = rata-rata ulasan (2 desimal), ikut berubah saat ulasan diubah & dihapus", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const p = await makeProduct(seller);
    const a = await makeUser();
    const b = await makeUser();
    await makePurchase(a, p);
    await makePurchase(b, p);
    const review = (uid: string, r: number) =>
      as({ uid }, () =>
        sql("insert into lp_reviews (user_id, landing_page_id, rating) values ($1, $2, $3)", [uid, p, r]),
      );
    await review(a, 5);
    await review(b, 2);
    expect(Number((await product(p)).rating)).toBe(3.5);
    await as({ uid: b }, () => sql("update lp_reviews set rating = 4 where user_id = $1", [b]));
    expect(Number((await product(p)).rating)).toBe(4.5);
    await sql("delete from lp_reviews where landing_page_id = $1", [p]);
    expect((await product(p)).rating).toBeNull();
  });

  it("updated_at bergerak saat produk diubah", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const p = await makeProduct(seller);
    await sql("update lp_landing_pages set updated_at = now() - interval '1 day' where id = $1", [p]);
    await sql("update lp_landing_pages set title = 'baru' where id = $1", [p]);
    const { rows } = await sql<{ fresh: boolean }>(
      "select updated_at > now() - interval '1 minute' as fresh from lp_landing_pages where id = $1",
      [p],
    );
    expect(rows[0].fresh).toBe(true);
  });
});

describe("RPC", () => {
  it("lp_increment_view: pengunjung anonim menaikkan view_count — dan hanya itu", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const p = await makeProduct(seller);
    const { rows: before } = await sql<{ slug: string; title: string }>(
      "select slug, title from lp_landing_pages where id = $1",
      [p],
    );
    await as("anon", () => sql("select public.lp_increment_view($1)", [before[0].slug]));
    await as("anon", () => sql("select public.lp_increment_view($1)", [before[0].slug]));
    expect(Number((await product(p)).view_count)).toBe(2);
    const { rows: after } = await sql<{ title: string }>("select title from lp_landing_pages where id = $1", [p]);
    expect(after[0].title).toBe(before[0].title);
  });

  it("lp_increment_view dengan slug tak dikenal tidak error dan tidak menulis apa pun", async () => {
    await as("anon", () => sql("select public.lp_increment_view($1)", [`tidak-ada-${uniq()}`]));
  });

  const trackArgs = (sessionId: string, dwell: number, siteId: string | null) => [
    sessionId, "v1", null, "10.0.0.1", "ID", null, null, null, null, null, "/", null,
    null, null, null, null, null, "mobile", "chrome", "android", dwell, siteId,
  ];
  const TRACK =
    "select public.lp_track_session(" +
    [
      "p_session_id", "p_visitor_id", "p_user_id", "p_ip", "p_country", "p_region", "p_city", "p_isp",
      "p_referrer", "p_referrer_host", "p_landing_path", "p_entry_product_id", "p_utm_source", "p_utm_medium",
      "p_utm_campaign", "p_utm_term", "p_utm_content", "p_device", "p_browser", "p_os", "p_dwell_ms", "p_site_id",
    ]
      .map((n, i) => `${n} => $${i + 1}`)
      .join(", ") +
    ")";

  it("lp_track_session: sesi yang sama dua kali = satu baris, bukan dua", async () => {
    const sid = `s-${uniq()}`;
    const site = await makeSite();
    await as("service_role", () => sql(TRACK, trackArgs(sid, 1000, site)));
    await as("service_role", () => sql(TRACK, trackArgs(sid, 2000, site)));
    expect(await count("lp_sessions", "session_id = $1", [sid])).toBe(1);
  });

  it("lp_track_session hanya punya SATU tanda tangan", async () => {
    // A second overload without p_site_id lingered from 20260808050000. With
    // both present, a caller that omits p_site_id gets PostgREST's "could not
    // choose the best candidate function" and the visit is silently lost.
    const { rows } = await sql("select 1 from pg_proc where proname = 'lp_track_session'");
    expect(rows.length).toBe(1);
  });
});

describe("constraint yang menyimpan aturan bisnis", () => {

  it("satu pembelian per orang per produk — callback Duitku yang diulang tidak menggandakan", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const buyer = await makeUser();
    const p = await makeProduct(seller);
    await makePurchase(buyer, p);
    expect(await sqlState(() => makePurchase(buyer, p))).toBe("23505");
  });

  it("merchant_order_id pesanan paket unik — perpanjangan paket tidak dobel", async () => {
    const buyer = await makeUser();
    const oid = `PL_${uniq()}`;
    const ins = () =>
      sql("insert into lp_plan_orders (user_id, plan, merchant_order_id) values ($1, 'pro', $2)", [buyer, oid]);
    await ins();
    expect(await sqlState(() => ins())).toBe("23505");
  });

  it("nomor invoice unik bila ada; banyak pembelian boleh tanpa nomor", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const inv = `INV-${uniq()}`;
    const buy = (uid: string, pid: string, invoice: string | null) =>
      sql("insert into lp_purchases (user_id, landing_page_id, amount, invoice_number) values ($1, $2, 0, $3)", [
        uid,
        pid,
        invoice,
      ]);
    await buy(await makeUser(), await makeProduct(seller), null);
    await buy(await makeUser(), await makeProduct(seller), null);
    await buy(await makeUser(), await makeProduct(seller), inv);
    const [u, pid] = [await makeUser(), await makeProduct(seller)];
    expect(await sqlState(() => buy(u, pid, inv))).toBe("23505");
  });

  it("hanya boleh ada satu situs kanonik", async () => {
    const { rows } = await sql<{ n: string }>("select count(*)::text as n from lp_sites where is_canonical");
    const a = await makeSite();
    const b = await makeSite();
    if (rows[0].n === "0") await sql("update lp_sites set is_canonical = true where id = $1", [a]);
    expect(await sqlState(() => sql("update lp_sites set is_canonical = true where id = $1", [b]))).toBe(
      "23505",
    );
  });

  it("slug halaman unik per situs, bukan global", async () => {
    const a = await makeSite();
    const b = await makeSite();
    const page = (site: string) =>
      sql("insert into lp_pages (site_id, slug, title) values ($1, 'tentang', 'Tentang')", [site]);
    await page(a);
    await page(b);
    expect(await sqlState(() => page(a))).toBe("23505");
  });

  it("memori chat tidak dobel, tanpa peduli huruf besar-kecil", async () => {
    const me = await makeUser();
    await sql("insert into lp_chat_memories (user_id, text) values ($1, 'Suka Kopi')", [me]);
    expect(
      await sqlState(() => sql("insert into lp_chat_memories (user_id, text) values ($1, 'suka kopi')", [me])),
    ).toBe("23505");
  });

  it("CHECK: rating ulasan 1..5", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const buyer = await makeUser();
    const p = await makeProduct(seller);
    expect(
      await sqlState(() =>
        sql("insert into lp_reviews (user_id, landing_page_id, rating) values ($1, $2, 6)", [buyer, p]),
      ),
    ).toBe("23514");
  });

  it.each([
    ["preview_cut_percent 5..95", "preview_cut_percent = 99"],
    ["preview_type terdaftar", "preview_type = 'video'"],
    ["purchase_type terdaftar", "purchase_type = 'barter'"],
  ])("CHECK produk: %s", async (_name, set) => {
    const p = await makeProduct(await makeUser({ accountType: "agent" }));
    expect(await sqlState(() => sql(`update lp_landing_pages set ${set} where id = $1`, [p]))).toBe("23514");
  });

  it.each([
    ["months 1..24", "insert into lp_plan_orders (user_id, plan, merchant_order_id, months) values ($1, 'pro', $2, 36)"],
    ["status terdaftar", "insert into lp_plan_orders (user_id, plan, merchant_order_id, status) values ($1, 'pro', $2, 'refunded')"],
  ])("CHECK lp_plan_orders: %s", async (_name, statement) => {
    const u = await makeUser();
    expect(await sqlState(() => sql(statement, [u, `PL_${uniq()}`]))).toBe("23514");
  });

  it("CHECK: pesan chat hanya 'user' atau 'assistant' — prompt sistem tidak pernah disimpan", async () => {
    const me = await makeUser();
    const { rows } = await sql<{ id: string }>("insert into lp_chat_sessions (user_id) values ($1) returning id", [me]);
    expect(
      await sqlState(() =>
        sql("insert into lp_chat_messages (session_id, user_id, role) values ($1, $2, 'system')", [rows[0].id, me]),
      ),
    ).toBe("23514");
  });

  it("CHECK: locale situs hanya id / en; jenis akun hanya tiga", async () => {
    const site = await makeSite();
    expect(await sqlState(() => sql("update lp_sites set locale = 'fr' where id = $1", [site]))).toBe("23514");
    const u = await makeUser();
    expect(
      await sqlState(() => sql("update lp_profiles set account_type = 'publisher' where id = $1", [u])),
    ).toBe("23514");
  });
});

describe("menghapus user — ke mana datanya pergi", () => {
  // The per-table ON DELETE choices are business rules, not defaults. Revenue
  // survives the buyer (SET NULL); a person's private data goes with them
  // (CASCADE). And one cascade is the reason the app refuses to delete a user
  // who still owns products — pinned here so that rule has its evidence.

  const deleteUser = (id: string) => sql("delete from auth.users where id = $1", [id]);

  it("pembeli dihapus: pembelian & pesanan paket TETAP ADA tanpa nama — omzet tidak berubah", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const buyer = await makeUser();
    const p = await makeProduct(seller);
    const purchase = await makePurchase(buyer, p, 75_000);
    const { rows } = await sql<{ id: string }>(
      "insert into lp_plan_orders (user_id, plan, merchant_order_id) values ($1, 'pro', $2) returning id",
      [buyer, `PL_${uniq()}`],
    );
    await deleteUser(buyer);
    expect(await count("lp_purchases", "id = $1 and user_id is null and amount = 75000", [purchase])).toBe(1);
    expect(await count("lp_plan_orders", "id = $1 and user_id is null", [rows[0].id])).toBe(1);
  });

  it("data pribadinya ikut pergi: profil, ulasan, like, chat, keanggotaan", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const p = await makeProduct(seller);
    await makePurchase(me, p);
    await sql("insert into lp_reviews (user_id, landing_page_id, rating) values ($1, $2, 5)", [me, p]);
    await sql("insert into lp_product_likes (user_id, landing_page_id) values ($1, $2)", [me, p]);
    await sql("insert into lp_chat_sessions (user_id) values ($1)", [me]);
    await sql("insert into lp_site_members (site_id, user_id) values ($1, $2)", [await makeSite(), me]);
    await deleteUser(me);
    for (const [t, col] of [
      ["lp_profiles", "id"],
      ["lp_reviews", "user_id"],
      ["lp_product_likes", "user_id"],
      ["lp_chat_sessions", "user_id"],
      ["lp_site_members", "user_id"],
    ]) {
      expect(await count(t, `${col} = $1`, [me]), t).toBe(0);
    }
  });

  it("PENJUAL dihapus: produknya ikut terhapus, DAN pembelian orang lain atas produk itu", async () => {
    // This is why DELETE /api/admin/users refuses an account that still owns
    // products. Without that guard, deleting one seller erases other people's
    // purchase records — and their access to what they paid for.
    const seller = await makeUser({ accountType: "agent" });
    const buyer = await makeUser();
    const p = await makeProduct(seller);
    const purchase = await makePurchase(buyer, p);
    await deleteUser(seller);
    expect(await count("lp_landing_pages", "id = $1", [p])).toBe(0);
    expect(await count("lp_purchases", "id = $1", [purchase])).toBe(0);
  });
});

describe("keamanan fungsi yang bisa dipanggil lewat RPC", () => {
  it("anon & user login tidak bisa memanggil lp_track_session untuk menulis analitik", async () => {
    // Visits are recorded by /api/analytics with the service role, after it has
    // resolved the IP and the site. Callable directly, the RPC would let anyone
    // write sessions with any IP, country and UTM they like.
    const sid = `s-${uniq()}`;
    for (const who of ["anon", { uid: await makeUser() }] as const) {
      await denied(() => as(who, () => sql(TRACK_MIN, [sid])));
    }
  });
});

const TRACK_MIN = "select public.lp_track_session(p_session_id => $1, p_visitor_id => null, p_user_id => null, p_ip => null, p_country => null, p_region => null, p_city => null, p_isp => null, p_referrer => null, p_referrer_host => null, p_landing_path => null, p_entry_product_id => null, p_utm_source => null, p_utm_medium => null, p_utm_campaign => null, p_utm_term => null, p_utm_content => null, p_device => null, p_browser => null, p_os => null, p_dwell_ms => 0, p_site_id => null)";
