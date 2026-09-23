import { describe, expect, it } from "vitest";
import { sql, sqlState } from "./sql";

/**
 * Business ledger data model (docs/plans/multi-business-saas.md, Fase 3).
 * Double-entry: a business balance is SUM(amount_cents), never a stored column.
 */
describe("business ledger", () => {
  async function business(pct = 10): Promise<string> {
    const { rows } = await sql<{ id: string }>(
      "insert into public.lp_businesses (name, slug, commission_pct) values ('Ledger', $1, $2) returning id",
      [`l-${Date.now()}-${Math.random().toString(36).slice(2)}`, pct],
    );
    return rows[0].id;
  }

  it("saldo = SUM(amount_cents); komisi mengurangi", async () => {
    const biz = await business(10);
    await sql(
      `insert into public.lp_business_ledger (business_id, kind, amount_cents, status)
       values ($1,'sale',100000,'pending'), ($1,'commission',-10000,'pending')`,
      [biz],
    );
    const { rows } = await sql<{ bal: string }>(
      "select coalesce(sum(amount_cents),0)::bigint as bal from public.lp_business_ledger where business_id=$1",
      [biz],
    );
    expect(Number(rows[0].bal)).toBe(90000); // 100k sale - 10% commission
  });

  it("entri baru masuk sebagai pending (hold), lalu bisa jadi available", async () => {
    const biz = await business();
    await sql(
      `insert into public.lp_business_ledger (business_id, kind, amount_cents, status, available_at)
       values ($1,'sale',50000,'pending', now() + interval '14 days')`,
      [biz],
    );
    const pending = await sql<{ n: string }>(
      "select count(*)::text n from public.lp_business_ledger where business_id=$1 and status='pending'",
      [biz],
    );
    expect(Number(pending.rows[0].n)).toBe(1);
  });

  it("payout mendebit saldo", async () => {
    const biz = await business(0);
    await sql(
      `insert into public.lp_business_ledger (business_id, kind, amount_cents, status)
       values ($1,'sale',80000,'available'), ($1,'payout',-80000,'available')`,
      [biz],
    );
    const { rows } = await sql<{ bal: string }>(
      "select coalesce(sum(amount_cents),0)::bigint as bal from public.lp_business_ledger where business_id=$1",
      [biz],
    );
    expect(Number(rows[0].bal)).toBe(0);
  });

  it("saldo tersedia mengecualikan entri yang masih hold (available_at di masa depan)", async () => {
    const biz = await business(10);
    await sql(
      `insert into public.lp_business_ledger (business_id, kind, amount_cents, status, available_at) values
         ($1,'sale',100000,'pending', now() - interval '1 day'),
         ($1,'commission',-10000,'pending', now() - interval '1 day'),
         ($1,'sale',50000,'pending', now() + interval '14 days')`,
      [biz],
    );
    // available = matured rows only (available_at null or <= now) — mirrors businessBalances()
    const { rows } = await sql<{ total: string; avail: string }>(
      `select coalesce(sum(amount_cents),0)::bigint total,
              coalesce(sum(amount_cents) filter (where available_at is null or available_at <= now()),0)::bigint avail
         from public.lp_business_ledger where business_id=$1`,
      [biz],
    );
    expect(Number(rows[0].total)).toBe(140000);
    expect(Number(rows[0].avail)).toBe(90000); // the 50k on-hold sale is excluded
  });

  it("refund mengurangi saldo seketika (tanpa hold)", async () => {
    const biz = await business(0);
    await sql(
      `insert into public.lp_business_ledger (business_id, kind, amount_cents, status) values
         ($1,'sale',100000,'available'),
         ($1,'refund',-30000,'available')`,
      [biz],
    );
    const { rows } = await sql<{ bal: string }>(
      "select coalesce(sum(amount_cents),0)::bigint bal from public.lp_business_ledger where business_id=$1",
      [biz],
    );
    expect(Number(rows[0].bal)).toBe(70000);
  });

});

/**
 * Payout execution (Fase 3, sisa: disbursement). The ledger says how much is
 * owed; lp_business_payouts says what happened when we tried to pay it.
 */
describe("lp_business_payouts", () => {
  async function business(): Promise<string> {
    const { rows } = await sql<{ id: string }>(
      "insert into public.lp_businesses (name, slug) values ('Payout', $1) returning id",
      [`p-${Date.now()}-${Math.random().toString(36).slice(2)}`],
    );
    return rows[0].id;
  }

  const insert = (biz: string, ref: string, extra = "") =>
    sql(
      `insert into public.lp_business_payouts (business_id, amount, ledger_ref${extra ? ", status" : ""})
       values ($1, 50000, $2${extra ? `, '${extra}'` : ""})`,
      [biz, ref],
    );

  it("ledger_ref unik — satu payout per debit, jadi retry tidak jadi transfer kedua", async () => {
    const biz = await business();
    const ref = `payout-${Math.random().toString(36).slice(2)}`;
    await insert(biz, ref);
    // 23505 = unique_violation. This is what makes a retried request idempotent.
    expect(await sqlState(() => insert(biz, ref))).toBe("23505");
  });

  it("jumlah harus positif — arah uang ada di ledger, bukan di tanda angka ini", async () => {
    const biz = await business();
    expect(
      await sqlState(() =>
        sql("insert into public.lp_business_payouts (business_id, amount, ledger_ref) values ($1, -1, $2)", [
          biz,
          `x-${Math.random()}`,
        ]),
      ),
    ).toBe("23514"); // check_violation
  });

  it("status di luar daftar ditolak — 'pending' tidak boleh berubah arti diam-diam", async () => {
    const biz = await business();
    expect(await sqlState(() => insert(biz, `y-${Math.random()}`, "selesai"))).toBe("23514");
    expect(await sqlState(() => insert(biz, `z-${Math.random()}`, "sent"))).toBeNull();
  });

  it("ikut terhapus bersama business-nya (tidak ada payout yatim)", async () => {
    const biz = await business();
    await insert(biz, `d-${Math.random()}`);
    await sql("delete from public.lp_businesses where id = $1", [biz]);
    const { rows } = await sql<{ n: string }>(
      "select count(*)::text n from public.lp_business_payouts where business_id = $1",
      [biz],
    );
    expect(Number(rows[0].n)).toBe(0);
  });
});
