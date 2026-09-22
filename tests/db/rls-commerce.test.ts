import { describe, expect, it } from "vitest";
import { as, count, denied, makeProduct, makePurchase, makeSite, makeUser, sql, uniq } from "./sql";

/**
 * Tables where a wrong policy costs money or trust: purchases, products,
 * reviews, likes, plan orders.
 *
 * The browser holds both the anon key and the user's access token, so anyone
 * can call PostgREST directly with a body the app would never send. These
 * tests assume exactly that caller. What the app's own forms happen to send is
 * irrelevant to them.
 */

const claim = (uid: string, productId: string, amount = 0) =>
  as({ uid }, () =>
    sql(
      `insert into lp_purchases (user_id, landing_page_id, amount, payment_method)
       values ($1, $2, $3, 'free')`,
      [uid, productId, amount],
    ),
  );

describe("lp_purchases — mengambil produk", () => {
  // The only purchase a signed-in user may create for themselves is a FREE one:
  // lib/actions/purchases.ts:addPurchase. Paid purchases are written by the
  // Duitku callback with the service role. The policy used to be just
  // `auth.uid() = user_id`, and addPurchase never checked the price either — so
  // replaying the "Ambil gratis" form with a paid product's id, or one POST to
  // /rest/v1/lp_purchases, handed over any paid product.

  it("boleh mengambil produk gratis (is_free)", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const { rowCount } = await claim(me, await makeProduct(seller, { isFree: true, price: 50_000 }));
    expect(rowCount).toBe(1);
  });

  it("boleh mengambil produk yang harganya 0 atau kosong", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    expect((await claim(me, await makeProduct(seller, { price: 0 }))).rowCount).toBe(1);
    expect((await claim(me, await makeProduct(seller, { price: null }))).rowCount).toBe(1);
  });

  it("TIDAK boleh mengambil produk berbayar", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    await denied(async () => claim(me, await makeProduct(seller, { price: 50_000 })));
  });

  it("TIDAK boleh mengambil produk berbayar yang sedang diskon", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    await denied(async () => claim(me, await makeProduct(seller, { price: 50_000, priceDiscount: 10_000 })));
  });

  it("TIDAK boleh mencatat nominal untuk produk gratis (omzet palsu di statistik penjual)", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    await denied(async () => claim(me, await makeProduct(seller, { isFree: true }), 999_000));
  });

  it("TIDAK boleh mengambil atas nama orang lain", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const other = await makeUser();
    const free = await makeProduct(seller, { isFree: true });
    await denied(() =>
      as({ uid: me }, () =>
        sql("insert into lp_purchases (user_id, landing_page_id, amount) values ($1, $2, 0)", [other, free]),
      ),
    );
  });

  it("anon tidak bisa mengambil apa pun", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const free = await makeProduct(seller, { isFree: true });
    await denied(() =>
      as("anon", () => sql("insert into lp_purchases (landing_page_id, amount) values ($1, 0)", [free])),
    );
  });
});

describe("lp_purchases — membaca & mengubah", () => {
  it("pembeli melihat pembeliannya sendiri", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const p = await makePurchase(me, await makeProduct(seller));
    const { rowCount } = await as({ uid: me }, () => sql("select id from lp_purchases where id = $1", [p]));
    expect(rowCount).toBe(1);
  });

  it("pembelian yang dicabut tidak terlihat lagi oleh pembelinya", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const p = await makePurchase(me, await makeProduct(seller));
    await sql("update lp_purchases set revoked_at = now() where id = $1", [p]);
    const { rowCount } = await as({ uid: me }, () => sql("select id from lp_purchases where id = $1", [p]));
    expect(rowCount).toBe(0);
  });

  it("tidak bisa membatalkan pencabutan sendiri", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const p = await makePurchase(me, await makeProduct(seller));
    await sql("update lp_purchases set revoked_at = now() where id = $1", [p]);
    const res = await as({ uid: me }, () =>
      sql("update lp_purchases set revoked_at = null where id = $1", [p]),
    ).catch((e) => e);
    expect(res.code === "42501" || res.rowCount === 0).toBe(true);
    expect(await count("lp_purchases", "id = $1 and revoked_at is not null", [p])).toBe(1);
  });

  it("tidak melihat pembelian orang lain", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const other = await makeUser();
    const p = await makePurchase(other, await makeProduct(seller));
    const { rowCount } = await as({ uid: me }, () => sql("select id from lp_purchases where id = $1", [p]));
    expect(rowCount).toBe(0);
  });

  it("tidak bisa mengubah nominal atau menghapus pembeliannya sendiri", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const p = await makePurchase(me, await makeProduct(seller), 50_000);
    const upd = await as({ uid: me }, () => sql("update lp_purchases set amount = 0 where id = $1", [p])).catch(
      (e) => e,
    );
    const del = await as({ uid: me }, () => sql("delete from lp_purchases where id = $1", [p])).catch((e) => e);
    for (const r of [upd, del]) expect(r.code === "42501" || r.rowCount === 0).toBe(true);
    expect(await count("lp_purchases", "id = $1 and amount = 50000", [p])).toBe(1);
  });
});

describe("lp_landing_pages — siapa boleh membuat produk", () => {
  // The app gates selling (canSellOnCurrentSite). The database used to let ANY
  // signed-in user insert a row they own — a plain customer could publish a
  // product, with a purchase_link of their choosing, straight into the catalog.

  const insertOwn = (uid: string) =>
    as({ uid }, () =>
      sql("insert into lp_landing_pages (title, slug, user_id) values ('x', $1, $2)", [`p-${uniq()}`, uid]),
    );

  it("customer biasa TIDAK boleh membuat produk", async () => {
    await denied(async () => insertOwn(await makeUser()));
  });

  it.each(["company", "agent"] as const)("%s boleh membuat produknya sendiri", async (accountType) => {
    expect((await insertOwn(await makeUser({ accountType }))).rowCount).toBe(1);
  });

  it("customer yang publisher di sebuah situs boleh membuat produk", async () => {
    const me = await makeUser();
    await sql("insert into lp_site_members (site_id, user_id, is_publisher) values ($1, $2, true)", [
      await makeSite(),
      me,
    ]);
    expect((await insertOwn(me)).rowCount).toBe(1);
  });

  it("anggota situs yang BUKAN publisher tidak boleh", async () => {
    const me = await makeUser();
    await sql("insert into lp_site_members (site_id, user_id) values ($1, $2)", [await makeSite(), me]);
    await denied(() => insertOwn(me));
  });

  it("tidak ada yang bisa membuat produk atas nama orang lain", async () => {
    const me = await makeUser({ accountType: "agent" });
    const other = await makeUser({ accountType: "agent" });
    await denied(() =>
      as({ uid: me }, () =>
        sql("insert into lp_landing_pages (title, slug, user_id) values ('x', $1, $2)", [`p-${uniq()}`, other]),
      ),
    );
  });
});

describe("lp_landing_pages — mengubah produk", () => {
  it("pemilik boleh mengubah isi produknya, termasuk mem-pin (setLandingPageFeatured)", async () => {
    const me = await makeUser({ accountType: "agent" });
    const p = await makeProduct(me);
    const { rowCount } = await as({ uid: me }, () =>
      sql("update lp_landing_pages set title = 'Baru', featured = true, published = false where id = $1", [p]),
    );
    expect(rowCount).toBe(1);
  });

  it.each(["sold_count", "view_count", "like_count", "rating"])(
    "pemilik TIDAK boleh menulis %s produknya sendiri (bukti sosial palsu)",
    async (column) => {
      // Only triggers and the SECURITY DEFINER view RPC write these. A seller
      // setting "Terjual 999" or a 5.0 rating is lying to buyers.
      const me = await makeUser({ accountType: "agent" });
      const p = await makeProduct(me);
      // 5 fits rating's numeric(3,2); 999 would fail as an overflow before the
      // grant is even consulted, and the test would pass for the wrong reason.
      const value = column === "rating" ? 5 : 999;
      await denied(() =>
        as({ uid: me }, () => sql(`update lp_landing_pages set ${column} = $2 where id = $1`, [p, value])),
      );
    },
  );

  it("penjual juga tidak bisa MELAHIRKAN produk dengan angka palsu", async () => {
    const me = await makeUser({ accountType: "agent" });
    await denied(() =>
      as({ uid: me }, () =>
        sql("insert into lp_landing_pages (title, slug, user_id, sold_count) values ('x', $1, $2, 999)", [
          `p-${uniq()}`,
          me,
        ]),
      ),
    );
  });

  it("bukan pemilik tidak bisa mengubah atau menghapus", async () => {
    const owner = await makeUser({ accountType: "agent" });
    const me = await makeUser({ accountType: "agent" });
    const p = await makeProduct(owner);
    const upd = await as({ uid: me }, () => sql("update lp_landing_pages set title = 'x' where id = $1", [p]));
    const del = await as({ uid: me }, () => sql("delete from lp_landing_pages where id = $1", [p]));
    expect([upd.rowCount, del.rowCount]).toEqual([0, 0]);
  });

  it("pemilik boleh menghapus produknya sendiri", async () => {
    const me = await makeUser({ accountType: "agent" });
    const p = await makeProduct(me);
    expect((await as({ uid: me }, () => sql("delete from lp_landing_pages where id = $1", [p]))).rowCount).toBe(1);
  });

  it("setiap kolom sudah diputuskan: yang tidak bisa ditulis penjual persis daftar ini", async () => {
    // UPDATE and INSERT are granted column by column (everything except the
    // list below). A column added later is therefore NOT writable until someone
    // grants it — the avatar_url trap. This makes that decision loud.
    const SERVICE_ONLY = ["business_id", "id", "like_count", "rating", "sold_count", "view_count"];
    for (const priv of ["UPDATE", "INSERT"]) {
      const { rows } = await sql<{ c: string }>(
        `select c.column_name as c from information_schema.columns c
          where c.table_name = 'lp_landing_pages'
            and not exists (select 1 from information_schema.column_privileges p
                             where p.table_name = c.table_name and p.column_name = c.column_name
                               and p.grantee = 'authenticated' and p.privilege_type = $1)
          order by 1`,
        [priv],
      );
      expect(rows.map((r) => r.c), priv).toEqual(SERVICE_ONLY);
    }
  });
});

describe("lp_landing_pages — membaca", () => {
  it("siapa pun melihat produk yang terbit", async () => {
    const p = await makeProduct(await makeUser({ accountType: "agent" }));
    expect((await as("anon", () => sql("select id from lp_landing_pages where id = $1", [p]))).rowCount).toBe(1);
  });

  // KNOWN GAP, pinned on purpose. The SELECT policy is `true`, so a draft is
  // readable through PostgREST by anyone who knows or enumerates it. Tightening
  // it touches dozens of read paths across the app (admin screens read others'
  // drafts through the user client), so it is recorded rather than rushed.
  // When it is fixed, this test starts failing: flip `it.fails` to `it`.
  it.fails("anon TIDAK melihat draft (celah yang diketahui)", async () => {
    const p = await makeProduct(await makeUser({ accountType: "agent" }), { published: false });
    expect((await as("anon", () => sql("select id from lp_landing_pages where id = $1", [p]))).rowCount).toBe(0);
  });
});

describe("lp_reviews", () => {
  const review = (uid: string, productId: string, rating = 1) =>
    as({ uid }, () =>
      sql("insert into lp_reviews (user_id, landing_page_id, rating) values ($1, $2, $3)", [uid, productId, rating]),
    );

  it("pembeli boleh mengulas produk yang dibelinya", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const p = await makeProduct(seller);
    await makePurchase(me, p);
    expect((await review(me, p, 5)).rowCount).toBe(1);
  });

  it("yang TIDAK membeli tidak boleh mengulas (menjatuhkan rating pesaing)", async () => {
    // lib/actions/reviews.ts refuses without a purchase; the database did not,
    // and the rating trigger turns every review into the product's public score.
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    await denied(async () => review(me, await makeProduct(seller)));
  });

  it("pembelian yang sudah dicabut tidak memberi hak mengulas", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const p = await makeProduct(seller);
    const purchase = await makePurchase(me, p);
    await sql("update lp_purchases set revoked_at = now() where id = $1", [purchase]);
    await denied(() => review(me, p));
  });

  it("siapa pun membaca ulasan; tidak ada yang bisa mengubah ulasan orang lain", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const author = await makeUser();
    const me = await makeUser();
    const p = await makeProduct(seller);
    await makePurchase(author, p);
    await review(author, p, 5);
    expect((await as("anon", () => sql("select id from lp_reviews where landing_page_id = $1", [p]))).rowCount).toBe(1);
    const upd = await as({ uid: me }, () => sql("update lp_reviews set rating = 1 where landing_page_id = $1", [p]));
    expect(upd.rowCount).toBe(0);
  });
});

describe("lp_product_likes", () => {
  it("menyukai & batal menyukai atas nama sendiri; tidak atas nama orang lain", async () => {
    const seller = await makeUser({ accountType: "agent" });
    const me = await makeUser();
    const other = await makeUser();
    const p = await makeProduct(seller);
    const like = (uid: string) =>
      as({ uid: me }, () =>
        sql("insert into lp_product_likes (user_id, landing_page_id) values ($1, $2)", [uid, p]),
      );
    expect((await like(me)).rowCount).toBe(1);
    await denied(() => like(other));
    expect(
      (await as({ uid: me }, () => sql("delete from lp_product_likes where landing_page_id = $1", [p]))).rowCount,
    ).toBe(1);
  });
});

describe("lp_plan_orders", () => {
  const order = async (uid: string) =>
    (
      await sql<{ id: string }>(
        "insert into lp_plan_orders (user_id, plan, merchant_order_id) values ($1, 'pro', $2) returning id",
        [uid, `PL_${uniq()}`],
      )
    ).rows[0].id;

  it("pemilik melihat pesanannya, orang lain tidak, Company melihat semua", async () => {
    const me = await makeUser();
    const other = await makeUser();
    const company = await makeUser({ accountType: "company" });
    const o = await order(me);
    const seen = async (uid: string) =>
      (await as({ uid }, () => sql("select id from lp_plan_orders where id = $1", [o]))).rowCount;
    expect([await seen(me), await seen(other), await seen(company)]).toEqual([1, 0, 1]);
  });

  it("user tidak bisa membuat pesanan sendiri atau menandainya lunas", async () => {
    // Orders are created by /api/plans/create-invoice and settled by the Duitku
    // callback — both service role. A self-marked 'paid' order must not exist.
    const me = await makeUser();
    await denied(() =>
      as({ uid: me }, () =>
        sql("insert into lp_plan_orders (user_id, plan, merchant_order_id, status) values ($1,'pro',$2,'paid')", [
          me,
          `PL_${uniq()}`,
        ]),
      ),
    );
    const o = await order(me);
    const upd = await as({ uid: me }, () => sql("update lp_plan_orders set status = 'paid' where id = $1", [o]));
    expect(upd.rowCount).toBe(0);
  });
});

describe("lp_landing_page_versions", () => {
  it("hanya pemilik produk yang bisa membaca & menulis versinya", async () => {
    const owner = await makeUser({ accountType: "agent" });
    const me = await makeUser({ accountType: "agent" });
    const p = await makeProduct(owner);
    await sql("insert into lp_landing_page_versions (landing_page_id, html_content) values ($1, '<p>v1</p>')", [p]);
    expect(
      (await as({ uid: me }, () => sql("select id from lp_landing_page_versions where landing_page_id = $1", [p])))
        .rowCount,
    ).toBe(0);
    await denied(() =>
      as({ uid: me }, () =>
        sql("insert into lp_landing_page_versions (landing_page_id, html_content) values ($1, 'x')", [p]),
      ),
    );
  });
});
