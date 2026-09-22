import type pg from "pg";
import { pool } from "./pool";
import { businessContext } from "./tenant";

/**
 * Run database work as a particular caller, with row-level security applied.
 *
 * This is what PostgREST did for every request, and what tests/db/sql.ts does
 * for every test: open a transaction, switch to the role the caller has
 * (`anon`, `authenticated`, or the RLS-bypassing `service_role`), and set the
 * JWT claims `auth.uid()` / `auth.role()` read. Every policy in the database is
 * written against exactly that, so keeping it means none of them change.
 *
 * Both settings are transaction-local (`set_config(…, true)`), so they vanish
 * at COMMIT or ROLLBACK and a pooled connection never carries one caller's
 * identity into the next caller's work. tests/db/with-rls.test.ts holds that.
 */

export type Who = "anon" | "service_role" | { uid: string };

export function roleOf(who: Who): "anon" | "authenticated" | "service_role" {
  return who === "anon" ? "anon" : who === "service_role" ? "service_role" : "authenticated";
}

export async function withRls<T>(who: Who, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const role = roleOf(who);
    const claims = typeof who === "object" ? { sub: who.uid, role } : { role };
    // Business context alongside the role/jwt: which business this request is
    // for, and whether the caller is Platform (bypasses business scoping). Both
    // transaction-local, like the role. Fase 1 only SETS them — no RLS reads
    // them yet — so this is inert until Fase 2's policies land.
    const ctx = businessContext();
    await client.query(
      `select set_config('role', $1, true), set_config('request.jwt.claims', $2, true),
              set_config('app.business_id', $3, true), set_config('app.is_platform', $4, true)`,
      [role, JSON.stringify(claims), ctx.businessId ?? "", ctx.isPlatform ? "on" : "off"],
    );
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
