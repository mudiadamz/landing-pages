import { describe, expect, it } from "vitest";
import { as, denied, makeProduct, makePurchase, makeUser, sql } from "./sql";

/**
 * Stock, which moves entirely inside the database (20260924010000).
 *
 * It has to: there are three ways a purchase row appears — the free claim, the
 * Duitku callback, and a bundle handing out its contents — and no single place
 * in TypeScript that all three pass through. A trigger is also atomic with the
 * insert, which is the only thing that makes two buyers pressing "buy" at the
 * same instant safe.
 *
 * None of this is visible from the app's side. A decrement that silently stops
 * happening looks exactly like a shop that is selling well.
 */

async function physical(stock: number | null): Promise<string> {
  const seller = await makeUser({ standing: "staff" });
  const p = await makeProduct(seller);
  await sql("update lp_landing_pages set product_type = 'physical', stock = $2 where id = $1", [
    p,
    stock,
  ]);
  return p;
}

const stockOf = async (id: string) =>
  (await sql<{ stock: number | null }>("select stock from lp_landing_pages where id = $1", [id]))
    .rows[0].stock;

const heldBy = async (purchaseId: string) =>
  (await sql<{ stock_held: boolean }>("select stock_held from lp_purchases where id = $1", [
    purchaseId,
  ])).rows[0].stock_held;

describe("stok berkurang saat pesanan masuk", () => {
  it("barang fisik yang stoknya dilacak berkurang satu, dan pesanannya menandai bahwa ia memegangnya", async () => {
    const p = await physical(5);
    const purchase = await makePurchase(await makeUser(), p);
    expect(await stockOf(p)).toBe(4);
    expect(await heldBy(purchase)).toBe(true);
  });

  it("stok NULL berarti TIDAK DILACAK — bukan nol, dan tidak boleh jadi nol", async () => {
    const p = await physical(null);
    const purchase = await makePurchase(await makeUser(), p);
    expect(await stockOf(p)).toBeNull();
    expect(await heldBy(purchase)).toBe(false);
  });

  it("produk digital tidak punya stok untuk dikurangi", async () => {
    const seller = await makeUser({ standing: "staff" });
    const p = await makeProduct(seller);
    await sql("update lp_landing_pages set stock = 5 where id = $1", [p]);
    await makePurchase(await makeUser(), p);
    // product_type masih 'digital': angka di kolom stock tidak berlaku baginya.
    expect(await stockOf(p)).toBe(5);
  });

  /**
   * The case the whole design bends around. By the time a purchase row is
   * written on the paid path, Duitku has already taken the money — so the
   * trigger must never refuse the insert. Overselling becomes an order the
   * seller has to sort out, which is a conversation; refusing would be a
   * payment taken for nothing, which is a theft.
   */
  it("stok 0 TIDAK menggagalkan pembelian — uang sudah berpindah sebelum baris ini ditulis", async () => {
    const p = await physical(0);
    const purchase = await makePurchase(await makeUser(), p);
    expect(await stockOf(p)).toBe(0);
    expect(await heldBy(purchase)).toBe(false);
  });
});

describe("stok kembali saat pesanan batal", () => {
  it("membatalkan pesanan yang memegang stok mengembalikannya, sekali", async () => {
    const p = await physical(3);
    const purchase = await makePurchase(await makeUser(), p);
    expect(await stockOf(p)).toBe(2);

    await sql("update lp_purchases set fulfillment_status = 'cancelled' where id = $1", [purchase]);
    expect(await stockOf(p)).toBe(3);
    expect(await heldBy(purchase)).toBe(false);

    // Menulis 'cancelled' lagi bukan perpindahan, jadi tidak menambah apa pun.
    await sql("update lp_purchases set fulfillment_status = 'cancelled' where id = $1", [purchase]);
    expect(await stockOf(p)).toBe(3);
  });

  /**
   * Without `stock_held` this is where inventory gets invented: an order that
   * arrived when the shelf was already empty never took a unit, so cancelling
   * it must not put one back.
   */
  it("membatalkan pesanan kelebihan-jual TIDAK menciptakan stok yang tidak pernah ada", async () => {
    const p = await physical(0);
    const purchase = await makePurchase(await makeUser(), p);
    await sql("update lp_purchases set fulfillment_status = 'cancelled' where id = $1", [purchase]);
    expect(await stockOf(p)).toBe(0);
  });

  it("status lain tidak menyentuh stok", async () => {
    const p = await physical(3);
    const purchase = await makePurchase(await makeUser(), p);
    for (const s of ["processing", "done"]) {
      await sql("update lp_purchases set fulfillment_status = $2 where id = $1", [purchase, s]);
    }
    expect(await stockOf(p)).toBe(2);
  });

  it("menghapus pesanan melepaskan stok yang dipegangnya", async () => {
    const p = await physical(3);
    const purchase = await makePurchase(await makeUser(), p);
    await sql("delete from lp_purchases where id = $1", [purchase]);
    expect(await stockOf(p)).toBe(3);
  });
});

describe("lp_pending_shipping", () => {
  const park = (userId: string, productId: string) =>
    sql(
      `insert into lp_pending_shipping
         (user_id, landing_page_id, shipping_name, shipping_phone, shipping_address,
          shipping_city, shipping_postal_code)
       values ($1, $2, 'Siti', '081234567890', 'Jl. Mawar 12', 'Bandung', '40123')`,
      [userId, productId],
    );

  it("pembeli hanya melihat alamatnya sendiri", async () => {
    const p = await physical(5);
    const a = await makeUser();
    const b = await makeUser();
    await park(a, p);

    expect((await as({ uid: a }, () => sql("select 1 from lp_pending_shipping"))).rowCount).toBe(1);
    expect((await as({ uid: b }, () => sql("select 1 from lp_pending_shipping"))).rowCount).toBe(0);
    expect((await as("anon", () => sql("select 1 from lp_pending_shipping"))).rowCount).toBe(0);
  });

  it("tidak bisa menitipkan alamat atas nama orang lain", async () => {
    const p = await physical(5);
    const a = await makeUser();
    const b = await makeUser();
    await denied(() => as({ uid: b }, () => park(a, p)));
  });

  /**
   * The seller is deliberately absent from this table's policies. An address
   * only becomes their business once it is attached to a paid order; a parked
   * one belongs to a checkout that may never complete.
   */
  it("penjual produknya pun tidak bisa membaca alamat yang masih menunggu", async () => {
    const seller = await makeUser({ standing: "staff" });
    const p = await makeProduct(seller);
    await sql("update lp_landing_pages set product_type = 'physical', stock = 5 where id = $1", [p]);
    const buyer = await makeUser();
    await park(buyer, p);
    expect(
      (await as({ uid: seller }, () => sql("select 1 from lp_pending_shipping"))).rowCount,
    ).toBe(0);
  });
});
