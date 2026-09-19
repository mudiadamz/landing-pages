import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, inject } from "vitest";

/**
 * SQL-level test harness.
 *
 * Every test runs inside a transaction that is ROLLED BACK afterwards, so no
 * test can leave a row behind for the next one and the order they run in never
 * matters. Importing this module is what installs those hooks.
 *
 * The point of the harness is `as()`: run a statement as the role a real caller
 * would have — `anon`, a signed-in user, or the service role — with the JWT
 * claims Supabase's `auth.uid()` / `auth.role()` read. That is what makes RLS
 * and column grants testable without an HTTP server in between.
 */

const client = new pg.Client({ connectionString: inject("dbUrl") });

beforeAll(async () => {
  await client.connect();
});
afterAll(async () => {
  await client.end();
});
beforeEach(async () => {
  await client.query("begin");
});
afterEach(async () => {
  await client.query("rollback");
});

export function sql<R extends pg.QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<R>> {
  return client.query<R>(text, params);
}

/** Who is making the call. A uid means "signed in as that user". */
export type Who = "anon" | "service_role" | { uid: string };

let savepoints = 0;

/**
 * Run `fn` as `who`, inside its own savepoint.
 *
 * On error the savepoint is rolled back and the error rethrown, so a DENIED
 * statement does not poison the rest of the test's transaction — which is what
 * lets one test check several things that are each supposed to fail.
 */
export async function as<T>(who: Who, fn: () => Promise<T>): Promise<T> {
  const sp = `as_${++savepoints}`;
  await client.query(`savepoint ${sp}`);
  try {
    const role = who === "anon" ? "anon" : who === "service_role" ? "service_role" : "authenticated";
    const claims =
      typeof who === "object" ? { sub: who.uid, role: "authenticated" } : { role };
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await client.query(`set local role ${role}`);
    const out = await fn();
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', true)");
    await client.query(`release savepoint ${sp}`);
    return out;
  } catch (e) {
    await client.query(`rollback to savepoint ${sp}`);
    await client.query("reset role");
    throw e;
  }
}

/**
 * Assert that `fn` is refused with SQLSTATE 42501 — Postgres's code for both
 * "permission denied" (grants) and "new row violates row-level security"
 * (RLS WITH CHECK). Returns the message so a test can say WHICH wall it hit.
 *
 * Note what this does NOT cover: an RLS-filtered UPDATE/DELETE/SELECT does not
 * raise, it just matches zero rows. Those are asserted with rowCount.
 */
export async function denied(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "42501") return err.message ?? "";
    throw e;
  }
  throw new Error("Diharapkan ditolak (42501), tapi pernyataannya BERHASIL.");
}

// ---------------------------------------------------------------------------
// Fixtures. All created as the table owner, i.e. outside RLS — they set the
// scene; the assertions are what run under `as()`.
// ---------------------------------------------------------------------------

export const uniq = () => randomUUID().slice(0, 8);

export type AccountType = "company" | "agent" | "customer";

/**
 * A user, created the way GoTrue creates one: an insert into auth.users, which
 * fires `lp_handle_new_user` and produces the lp_profiles row. So every test
 * that makes a user is also, quietly, a test that signup works.
 */
export async function makeUser(
  opts: { accountType?: AccountType; provider?: "email" | "google"; fullName?: string } = {},
): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into auth.users
       (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
             'authenticated', $1, 'x', now(), now(), $2, $3)
     returning id`,
    [
      `t-${uniq()}@test.local`,
      JSON.stringify({ provider: opts.provider ?? "email" }),
      JSON.stringify({ full_name: opts.fullName ?? "Uji" }),
    ],
  );
  const id = rows[0].id;
  if (opts.accountType && opts.accountType !== "customer") {
    await sql("update public.lp_profiles set account_type = $2 where id = $1", [id, opts.accountType]);
  }
  return id;
}

/** A user whose auth row exists but whose lp_profiles row does not. */
export async function makeUserWithoutProfile(): Promise<string> {
  const id = await makeUser();
  await sql("delete from public.lp_profiles where id = $1", [id]);
  return id;
}

export async function makeSite(): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    "insert into public.lp_sites (host, name) values ($1, 'Situs uji') returning id",
    [`${uniq()}.test.local`],
  );
  return rows[0].id;
}

export async function makeProduct(
  ownerId: string,
  opts: { isFree?: boolean; price?: number | null; priceDiscount?: number | null; published?: boolean } = {},
): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into public.lp_landing_pages (title, slug, user_id, is_free, price, price_discount, published)
     values ('Produk uji', $1, $2, $3, $4, $5, $6) returning id`,
    [
      `p-${uniq()}`,
      ownerId,
      opts.isFree ?? false,
      opts.price === undefined ? 50_000 : opts.price,
      opts.priceDiscount ?? null,
      opts.published ?? true,
    ],
  );
  return rows[0].id;
}

export async function makePurchase(userId: string, productId: string, amount = 50_000): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into public.lp_purchases (user_id, landing_page_id, amount, payment_method)
     values ($1, $2, $3, 'test') returning id`,
    [userId, productId, amount],
  );
  return rows[0].id;
}

export async function count(table: string, where = "true", params: unknown[] = []): Promise<number> {
  const { rows } = await sql<{ n: string }>(`select count(*)::text as n from ${table} where ${where}`, params);
  return Number(rows[0].n);
}
