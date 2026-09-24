import { describe, expect, it } from "vitest";
import { as, makeProduct, makePurchase, makeUser, sql, sqlState } from "./sql";

/**
 * The order lifecycle, at the level where it can actually go wrong
 * (20260924000000_product_types.sql).
 *
 * Three of these guard things that fail SILENTLY:
 *
 *  - the column grant, because a missing one makes the panel's save fail with
 *    "permission denied for table" long after the column looked fine in tsc;
 *  - the default on new rows, because a default of 'done' would mark every
 *    physical order delivered the moment an insert path forgot to set it;
 *  - the separation of fulfilment from ACCESS, because gating a download on
 *    'done' is the obvious-looking change that breaks every digital product
 *    whose status was never set.
 */

const statusOf = async (purchaseId: string) =>
  (
    await sql<{ fulfillment_status: string; fulfilled_at: string | null }>(
      "select fulfillment_status, fulfilled_at from lp_purchases where id = $1",
      [purchaseId],
    )
  ).rows[0];

describe("jenis produk", () => {
  it("produk lama tanpa jenis tetap 'digital' — seluruh katalog sebelum kolom ini memang itu", async () => {
    const seller = await makeUser({ standing: "staff" });
    const p = await makeProduct(seller);
    const { rows } = await sql<{ product_type: string }>(
      "select product_type from lp_landing_pages where id = $1",
      [p],
    );
    expect(rows[0].product_type).toBe("digital");
  });

  it("menolak jenis yang tidak dikenal", async () => {
    const seller = await makeUser({ standing: "staff" });
    const p = await makeProduct(seller);
    expect(
      await sqlState(() =>
        sql("update lp_landing_pages set product_type = 'hovercraft' where id = $1", [p]),
      ),
    ).toBe("23514");
  });

  it("menolak stok negatif, tapi menerima NULL (= tidak dilacak)", async () => {
    const seller = await makeUser({ standing: "staff" });
    const p = await makeProduct(seller);
    expect(
      await sqlState(() => sql("update lp_landing_pages set stock = -1 where id = $1", [p])),
    ).toBe("23514");
    await sql("update lp_landing_pages set stock = null where id = $1", [p]);
    await sql("update lp_landing_pages set stock = 0 where id = $1", [p]);
  });

  /**
   * The grant list, asked the way the panel asks it: as the signed-in owner,
   * through the same role the app connects with. `GRANT ALL ON TABLE` does not
   * cover this table for `authenticated` — every writable column is listed one
   * by one — so a new column is unwritable until someone says otherwise.
   */
  it("pemilik produk boleh menulis kolom jenis baru lewat role authenticated", async () => {
    const seller = await makeUser({ standing: "staff" });
    const p = await makeProduct(seller);
    await as({ uid: seller }, () =>
      sql(
        `update lp_landing_pages
            set product_type = 'service', sku = 'SKU-1', stock = 3, unit = 'sesi',
                service_duration_minutes = 60, service_mode = 'remote',
                fulfillment_note = 'Kami hubungi untuk atur jadwal'
          where id = $1`,
        [p],
      ),
    );
    const { rows } = await sql<{ product_type: string; service_mode: string }>(
      "select product_type, service_mode from lp_landing_pages where id = $1",
      [p],
    );
    expect(rows[0]).toEqual({ product_type: "service", service_mode: "remote" });
  });
});

describe("siklus pemenuhan", () => {
  it("baris baru default 'pending' — sisi yang ketahuan kalau ada jalur insert yang lupa", async () => {
    const seller = await makeUser({ standing: "staff" });
    const buyer = await makeUser();
    const p = await makeProduct(seller);
    const purchase = await makePurchase(buyer, p);
    expect((await statusOf(purchase)).fulfillment_status).toBe("pending");
  });

  it("menolak status yang tidak dikenal", async () => {
    const seller = await makeUser({ standing: "staff" });
    const purchase = await makePurchase(await makeUser(), await makeProduct(seller));
    expect(
      await sqlState(() =>
        sql("update lp_purchases set fulfillment_status = 'shipped' where id = $1", [purchase]),
      ),
    ).toBe("23514");
  });

  /**
   * The invariant the whole feature rests on. A buyer's own SELECT policy is
   * what the download route, the reader and the panel list all read through; if
   * fulfilment ever entered that policy, an order waiting to be posted would
   * stop being the buyer's, and every digital purchase whose status was missed
   * would vanish from the library that already paid for it.
   */
  it("status pemenuhan TIDAK menentukan akses — pesanan 'pending' tetap terlihat pembelinya", async () => {
    const seller = await makeUser({ standing: "staff" });
    const buyer = await makeUser();
    const p = await makeProduct(seller);
    const purchase = await makePurchase(buyer, p);
    await sql("update lp_purchases set fulfillment_status = 'pending' where id = $1", [purchase]);

    const seen = await as({ uid: buyer }, () =>
      sql("select id from lp_purchases where id = $1", [purchase]),
    );
    expect(seen.rowCount).toBe(1);

    // And a cancelled order is still not a revoked one: cancelling is a
    // statement about the order, revoking is the access decision.
    await sql("update lp_purchases set fulfillment_status = 'cancelled' where id = $1", [purchase]);
    const stillSeen = await as({ uid: buyer }, () =>
      sql("select id from lp_purchases where id = $1", [purchase]),
    );
    expect(stillSeen.rowCount).toBe(1);

    await sql("update lp_purchases set revoked_at = now() where id = $1", [purchase]);
    const hidden = await as({ uid: buyer }, () =>
      sql("select id from lp_purchases where id = $1", [purchase]),
    );
    expect(hidden.rowCount).toBe(0);
  });
});
