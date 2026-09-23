import { describe, expect, it } from "vitest";
import { as, denied, makeProduct, makeUser, sql, uniq } from "./sql";

/**
 * Tables whose security IS the absence of a policy.
 *
 * RLS is on and there is no policy, so nothing but the service role gets in:
 * visitor IPs and geolocation, the promo e-mail list, signup throttling, and —
 * since 20260919030000 — the support inbox. A backend that reads "this table
 * has no rules" as "this table is open" leaks all of it, and nothing on screen
 * would look wrong: pages still render, with more data than they should.
 */

// Minimal row per table, inserted as the owner to set the scene.
const DENY_ALL: Record<string, { cols: string; vals: () => unknown[] }> = {
  lp_sessions: { cols: "session_id", vals: () => [`s-${uniq()}`] },
  lp_page_events: { cols: "session_id, path", vals: () => [`s-${uniq()}`, "/"] },
  lp_ip_geo: { cols: "ip", vals: () => [`10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`] },
  lp_excluded_ips: { cols: "ip", vals: () => [`10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`] },
  lp_signup_attempts: { cols: "ip", vals: () => [`10.2.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`] },
  lp_promo_subscribers: { cols: "email", vals: () => [`p-${uniq()}@test.local`] },
  lp_received_emails: {
    cols: "resend_email_id, from_address, received_at",
    vals: () => [`re_${uniq()}`, "pelanggan@test.local", new Date().toISOString()],
  },
};

const placeholders = (n: number) => Array.from({ length: n }, (_, i) => `$${i + 1}`).join(", ");

describe("tabel yang hanya boleh disentuh service role", () => {
  for (const [table, { cols, vals }] of Object.entries(DENY_ALL)) {
    describe(table, () => {
      it("anon & user login tidak melihat satu baris pun", async () => {
        const v = vals();
        await sql(`insert into ${table} (${cols}) values (${placeholders(v.length)})`, v);
        const company = await makeUser({ standing: "platform" });
        for (const who of ["anon", { uid: await makeUser() }, { uid: company }] as const) {
          const { rowCount } = await as(who, () => sql(`select 1 from ${table}`));
          expect(rowCount, JSON.stringify(who)).toBe(0);
        }
      });

      it("anon & user login tidak bisa menulis", async () => {
        for (const who of ["anon", { uid: await makeUser() }] as const) {
          const v = vals();
          await denied(() => as(who, () => sql(`insert into ${table} (${cols}) values (${placeholders(v.length)})`, v)));
        }
      });

      it("service role melihatnya (jalur yang dipakai aplikasi)", async () => {
        const v = vals();
        await sql(`insert into ${table} (${cols}) values (${placeholders(v.length)})`, v);
        const { rowCount } = await as("service_role", () => sql(`select 1 from ${table}`));
        expect(rowCount).toBeGreaterThan(0);
      });
    });
  }

  it("daftarnya lengkap: setiap tabel lp_ tanpa policy ada di daftar di atas, dan sebaliknya", async () => {
    // A new table with RLS on and no policy is deny-all by accident; one listed
    // here that gains a policy has been opened. Either way, decide on purpose.
    const { rows } = await sql<{ t: string }>(
      `select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'lp\\_%'
          and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
        order by 1`,
    );
    expect(rows.map((r) => r.t)).toEqual(Object.keys(DENY_ALL).sort());
  });

  it("setiap tabel lp_ menyalakan RLS — tanpa kecuali", async () => {
    const { rows } = await sql<{ t: string }>(
      `select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'lp\\_%' and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });
});

describe("lp_received_emails — inbox support", () => {
  it("customer yang login TIDAK bisa membaca inbox (dulu bisa: policy-nya 'semua user login')", async () => {
    await sql("insert into lp_received_emails (resend_email_id, from_address, received_at) values ($1, 'x@t', now())", [
      `re_${uniq()}`,
    ]);
    const { rowCount } = await as({ uid: await makeUser() }, () => sql("select id from lp_received_emails"));
    expect(rowCount).toBe(0);
  });
});

describe("lp_contacts — formulir kontak", () => {
  const submit = (who: "anon" | { uid: string }) =>
    as(who, () =>
      sql("insert into lp_contacts (name, email, message) values ('Budi', 'b@t.local', 'halo')"),
    );

  it("siapa pun boleh mengirim — pengunjung anonim juga", async () => {
    expect((await submit("anon")).rowCount).toBe(1);
    expect((await submit({ uid: await makeUser() })).rowCount).toBe(1);
  });

  it("hanya Company yang membaca; pengirim pun tidak melihat kiriman orang lain", async () => {
    await sql("insert into lp_contacts (name, email, message) values ('Rahasia', 'r@t.local', 'data pribadi')");
    const seen = async (who: "anon" | { uid: string }) =>
      (await as(who, () => sql("select id from lp_contacts where name = 'Rahasia'"))).rowCount;
    expect(await seen("anon")).toBe(0);
    expect(await seen({ uid: await makeUser() })).toBe(0);
    expect(await seen({ uid: await makeUser({ standing: "staff" }) })).toBe(0);
    expect(await seen({ uid: await makeUser({ standing: "platform" }) })).toBe(1);
  });
});

describe("lp_product_events — analitik per produk", () => {
  it("pemilik produk membaca eventnya; penjual lain tidak; tidak ada yang menulis lewat API", async () => {
    const owner = await makeUser({ standing: "staff" });
    const rival = await makeUser({ standing: "staff" });
    const p = await makeProduct(owner);
    await sql("insert into lp_product_events (landing_page_id, kind) values ($1, 'view')", [p]);
    const seen = async (uid: string) =>
      (await as({ uid }, () => sql("select id from lp_product_events where landing_page_id = $1", [p]))).rowCount;
    expect([await seen(owner), await seen(rival)]).toEqual([1, 0]);
    await denied(() =>
      as({ uid: owner }, () => sql("insert into lp_product_events (landing_page_id, kind) values ($1, 'view')", [p])),
    );
  });
});
