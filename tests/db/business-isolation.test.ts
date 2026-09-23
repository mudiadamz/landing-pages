import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { resetPool } from "@/lib/backend/pool";
import { getBundleItemIds } from "@/lib/bundle";

/**
 * Cross-business leaks through PRODUCT REFERENCES (docs/plans/multi-business-saas.md,
 * the "sisa (belum diisolasi)" note under Fase 2).
 *
 * Catalog reads were scoped in Fase 2, but a product can also point AT another
 * product — related_product_ids, next_product_id, bundle_product_ids — and those
 * ids are stored, not filtered. The bundle one is the dangerous member of the
 * family: grantBundleItems turns every listed id into a real lp_purchases row for
 * the buyer, so a bundle listing another business's product would hand that
 * product away for free.
 *
 * Isolation for these lives in the application layer, not in RLS (Fase 2 decided
 * against restrictive read policies — they broke unstable_cache), so it is tested
 * here against a real database rather than as a policy.
 *
 * Runs outside the rollback harness in ./sql because it calls the app's own code,
 * which connects through the pool; rows are cleaned up in afterAll.
 */

const DB = inject("dbUrl");
const APP_DB = inject("appDbUrl");

let raw: pg.Client;
let sellerId: string;
const businesses: string[] = [];

const uid = () => crypto.randomUUID().slice(0, 8);

async function makeBusiness(): Promise<string> {
  const { rows } = await raw.query<{ id: string }>(
    "insert into public.lp_businesses (name, slug) values ('Uji', $1) returning id",
    [`bi-${uid()}`],
  );
  businesses.push(rows[0].id);
  return rows[0].id;
}

async function makeProduct(businessId: string | null, bundleIds?: string[]): Promise<string> {
  const { rows } = await raw.query<{ id: string }>(
    `insert into public.lp_landing_pages (title, slug, user_id, business_id, bundle_product_ids, published)
     values ('Produk uji', $1, $2, $3, $4, true) returning id`,
    [`bi-${uid()}`, sellerId, businessId, bundleIds ?? null],
  );
  return rows[0].id;
}

beforeAll(async () => {
  await resetPool(APP_DB);
  raw = new pg.Client({ connectionString: DB });
  await raw.connect();
  const { rows } = await raw.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
                             raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             $1, 'x', now(), now(), '{"provider":"email"}', '{}')
     returning id`,
    [`bi-${uid()}@test.local`],
  );
  sellerId = rows[0].id;
});

afterAll(async () => {
  // Products cascade from the user; businesses do not, so they go explicitly.
  await raw.query("delete from auth.users where id = $1", [sellerId]);
  await raw.query("delete from public.lp_businesses where id = any($1)", [businesses]);
  await raw.end();
  await resetPool();
});

describe("bundle tidak boleh memberikan produk business lain", () => {
  it("item lintas-business dibuang; item se-business tetap", async () => {
    const a = await makeBusiness();
    const b = await makeBusiness();
    const mine = await makeProduct(a);
    const theirs = await makeProduct(b);
    const bundle = await makeProduct(a, [mine, theirs]);

    expect(await getBundleItemIds(bundle)).toEqual([mine]);
  });

  it("bundle tanpa business (deployment 1-business) tetap memberikan semuanya", async () => {
    const one = await makeProduct(null);
    const two = await makeProduct(null);
    const bundle = await makeProduct(null, [one, two]);

    expect((await getBundleItemIds(bundle)).sort()).toEqual([one, two].sort());
  });

  it("bundle yang memuat dirinya sendiri tidak menghasilkan apa-apa", async () => {
    const a = await makeBusiness();
    const bundle = await makeProduct(a);
    await raw.query("update public.lp_landing_pages set bundle_product_ids = $2 where id = $1", [
      bundle,
      [bundle],
    ]);

    expect(await getBundleItemIds(bundle)).toEqual([]);
  });
});
