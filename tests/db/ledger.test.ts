import { describe, expect, it } from "vitest";
import { sql } from "./sql";

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
});
