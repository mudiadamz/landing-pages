import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { pool, resetPool } from "@/lib/backend/pool";
import { withRls } from "@/lib/backend/rls";

/**
 * The worst bug this backend could have, and the one no screen would show:
 * one caller's identity surviving on a pooled connection into the next
 * caller's query. Then an anonymous visitor's request runs as the last
 * signed-in user — or as the service role.
 *
 * The pool is forced to ONE connection here, so every call below is
 * guaranteed to reuse the connection the previous call left behind.
 */

const who = (c: { query: (s: string) => Promise<{ rows: { r: string; claims: string | null }[] }> }) =>
  c.query("select current_user::text as r, nullif(current_setting('request.jwt.claims', true), '') as claims");

beforeAll(async () => {
  process.env.DATABASE_POOL_MAX = "1";
  await resetPool(inject("dbUrl"));
});

afterAll(async () => {
  delete process.env.DATABASE_POOL_MAX;
  await resetPool();
});

describe("withRls — identitas tidak bocor antar pemanggil", () => {
  it("setiap pemanggil mendapat role & klaimnya sendiri", async () => {
    const uid = crypto.randomUUID();
    const a = await withRls({ uid }, async (c) => (await who(c)).rows[0]);
    expect(a.r).toBe("authenticated");
    expect(JSON.parse(a.claims!)).toMatchObject({ sub: uid, role: "authenticated" });

    const b = await withRls("anon", async (c) => (await who(c)).rows[0]);
    expect(b.r).toBe("anon");
    expect(JSON.parse(b.claims!).sub).toBeUndefined();

    const s = await withRls("service_role", async (c) => (await who(c)).rows[0]);
    expect(s.r).toBe("service_role");
  });

  it("sesudah transaksi, koneksi kembali ke role login tanpa klaim", async () => {
    await withRls({ uid: crypto.randomUUID() }, async (c) => who(c));
    const c = await pool().connect();
    try {
      const after = (await who(c)).rows[0];
      expect(after.r).not.toMatch(/^(anon|authenticated|service_role)$/);
      expect(after.claims).toBeNull();
    } finally {
      c.release();
    }
  });

  it("gagal di tengah transaksi pun tidak meninggalkan identitas", async () => {
    await expect(
      withRls("service_role", async (c) => {
        await c.query("select 1/0");
      }),
    ).rejects.toThrow();
    const next = await withRls("anon", async (c) => (await who(c)).rows[0]);
    expect(next.r).toBe("anon");
  });

  it("RLS benar-benar berlaku di dalamnya — anon tidak melihat profil siapa pun", async () => {
    const n = await withRls("anon", async (c) => (await c.query("select count(*)::int as n from lp_profiles")).rows[0].n);
    expect(n).toBe(0);
    const all = await withRls("service_role", async (c) => (await c.query("select count(*)::int as n from lp_profiles")).rows[0].n);
    expect(all).toBeGreaterThan(0);
  });
});
