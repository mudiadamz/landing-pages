import { describe, expect, it } from "vitest";
import { as, denied, makeSite, makeUser, sql, uniq } from "./sql";

/**
 * Storefront configuration and who belongs where.
 *
 * The rule the app states in lib/site-membership.ts:canManageSite is "Company,
 * or an Agent OF THIS SITE". The database has to say the same thing, because
 * most settings screens write through the user client: if the database is
 * stricter, the screen fails for the people it was built for; if it is looser,
 * one PostgREST call reaches another storefront.
 */

const agentOf = async (siteId: string) => {
  const uid = await makeUser({ standing: "admin" });
  await sql("insert into lp_site_agents (site_id, user_id) values ($1, $2)", [siteId, uid]);
  return uid;
};

const saveSetting = (who: string, siteId: string, key = `k_${uniq()}`) =>
  as({ uid: who }, () =>
    sql(
      `insert into lp_site_settings (site_id, key, value) values ($1, $2, '{"x":1}')
       on conflict (site_id, key) do update set value = excluded.value`,
      [siteId, key],
    ),
  );

describe("lp_site_settings — siapa boleh menyimpan setelan situs", () => {
  // lib/actions/site-settings.ts gates with requireSiteAdmin(siteId) /
  // requireFeature(...) — both let an Agent through — and then upserts with the
  // USER client. The policies used to allow Company only, so every settings
  // screen an Agent could open (tracking, plans, social links, popup, hero,
  // content, legal, hiring, custom JS, role permissions) failed on save.

  it("Company menyimpan setelan situs mana pun", async () => {
    const company = await makeUser({ standing: "platform" });
    expect((await saveSetting(company, await makeSite())).rowCount).toBe(1);
  });

  it("Agent menyimpan setelan situs yang dia kelola — insert maupun update", async () => {
    const site = await makeSite();
    const agent = await agentOf(site);
    const key = `k_${uniq()}`;
    expect((await saveSetting(agent, site, key)).rowCount).toBe(1);
    expect((await saveSetting(agent, site, key)).rowCount).toBe(1);
  });

  it("Agent TIDAK bisa menyentuh setelan situs lain", async () => {
    const mine = await makeSite();
    const theirs = await makeSite();
    const agent = await agentOf(mine);
    await denied(() => saveSetting(agent, theirs));
    // …not even by updating a row that already exists there.
    await sql("insert into lp_site_settings (site_id, key, value) values ($1, 'tracking', '{}')", [theirs]);
    const upd = await as({ uid: agent }, () =>
      sql("update lp_site_settings set value = '{\"gtmId\":\"GTM-EVIL\"}' where site_id = $1", [theirs]),
    );
    expect(upd.rowCount).toBe(0);
  });

  it("jenis akun 'agent' saja tidak cukup — harus terdaftar sebagai Agent situs itu", async () => {
    const site = await makeSite();
    const agentElsewhere = await makeUser({ standing: "admin" });
    await denied(() => saveSetting(agentElsewhere, site));
  });

  it("customer dan anon tidak bisa menyimpan setelan", async () => {
    const site = await makeSite();
    await denied(async () => saveSetting(await makeUser(), site));
    await denied(() =>
      as("anon", () => sql("insert into lp_site_settings (site_id, key, value) values ($1, 'x', '{}')", [site])),
    );
  });

  it("siapa pun membaca setelan (storefront merendernya untuk pengunjung)", async () => {
    const site = await makeSite();
    await sql("insert into lp_site_settings (site_id, key, value) values ($1, 'hero', '{}')", [site]);
    const { rowCount } = await as("anon", () => sql("select key from lp_site_settings where site_id = $1", [site]));
    expect(rowCount).toBe(1);
  });
});

describe("lp_sites — domain & branding hanya Company", () => {
  // Every action in lib/actions/sites.ts is gated by requireAdmin(): creating,
  // re-pointing, rebranding and deleting a storefront are not delegated. The
  // database agrees; these tests keep it that way — an Agent flipping
  // is_canonical or re-pointing host would take over routing for every domain.

  it("Company membuat, mengubah, dan menghapus situs", async () => {
    const company = await makeUser({ standing: "platform" });
    const site = await makeSite();
    const ins = await as({ uid: company }, () =>
      sql("insert into lp_sites (host, name) values ($1, 'Baru')", [`${uniq()}.test.local`]),
    );
    const upd = await as({ uid: company }, () => sql("update lp_sites set name = 'Ganti' where id = $1", [site]));
    const del = await as({ uid: company }, () => sql("delete from lp_sites where id = $1", [site]));
    expect([ins.rowCount, upd.rowCount, del.rowCount]).toEqual([1, 1, 1]);
  });

  it("Agent situs itu pun TIDAK bisa mengubah host / is_canonical / branding", async () => {
    const site = await makeSite();
    const agent = await agentOf(site);
    for (const set of ["host = 'evil.test'", "is_canonical = true", "name = 'Dibajak'", "active = false"]) {
      const r = await as({ uid: agent }, () => sql(`update lp_sites set ${set} where id = $1`, [site]));
      expect(r.rowCount, set).toBe(0);
    }
  });

  it("customer/anon tidak bisa membuat situs; semua orang bisa membaca", async () => {
    await denied(async () =>
      as({ uid: await makeUser() }, () => sql("insert into lp_sites (host, name) values ($1, 'x')", [`${uniq()}.t`])),
    );
    const site = await makeSite();
    expect((await as("anon", () => sql("select id from lp_sites where id = $1", [site]))).rowCount).toBe(1);
  });
});

describe("lp_landing_page_categories — katalog bersama, hanya Company", () => {
  it("Company mengelola; Agent & customer tidak; semua membaca", async () => {
    const company = await makeUser({ standing: "platform" });
    const agent = await makeUser({ standing: "admin" });
    const slug = `c-${uniq()}`;
    const ins = (uid: string, s: string) =>
      as({ uid }, () => sql("insert into lp_landing_page_categories (name, slug) values ('Kat', $1)", [s]));
    expect((await ins(company, slug)).rowCount).toBe(1);
    await denied(() => ins(agent, `c-${uniq()}`));
    await denied(async () => ins(await makeUser(), `c-${uniq()}`));
    expect(
      (await as("anon", () => sql("select id from lp_landing_page_categories where slug = $1", [slug]))).rowCount,
    ).toBe(1);
  });
});

describe("lp_pages — halaman editorial", () => {
  it("yang terbit terbaca siapa pun; draft tidak; tidak ada yang menulis lewat API", async () => {
    const site = await makeSite();
    await sql(
      "insert into lp_pages (site_id, slug, title, published) values ($1, 'tentang', 'Tentang', true), ($1, 'draft', 'Draft', false)",
      [site],
    );
    const { rows } = await as("anon", () =>
      sql<{ slug: string }>("select slug from lp_pages where site_id = $1 order by slug", [site]),
    );
    expect(rows.map((r) => r.slug)).toEqual(["tentang"]);
    const company = await makeUser({ standing: "platform" });
    await denied(() =>
      as({ uid: company }, () =>
        sql("insert into lp_pages (site_id, slug, title) values ($1, 'x', 'x')", [site]),
      ),
    );
  });
});

describe("lp_site_members & lp_site_agents — keanggotaan", () => {
  // The seller check (lp_can_sell) and the site manager check both read these
  // tables. A user who could write their own row here could make themselves a
  // publisher, or an Agent of any storefront.

  it("user membaca baris keanggotaannya sendiri, bukan milik orang lain", async () => {
    const site = await makeSite();
    const me = await makeUser();
    const other = await makeUser();
    await sql("insert into lp_site_members (site_id, user_id) values ($1, $2), ($1, $3)", [site, me, other]);
    const { rows } = await as({ uid: me }, () =>
      sql<{ user_id: string }>("select user_id from lp_site_members where site_id = $1", [site]),
    );
    expect(rows.map((r) => r.user_id)).toEqual([me]);
  });

  it("TIDAK bisa menjadikan dirinya publisher", async () => {
    const site = await makeSite();
    const me = await makeUser();
    await sql("insert into lp_site_members (site_id, user_id) values ($1, $2)", [site, me]);
    const upd = await as({ uid: me }, () =>
      sql("update lp_site_members set is_publisher = true, publisher_status = 'approved' where user_id = $1", [me]),
    ).catch((e) => e);
    expect(upd.code === "42501" || upd.rowCount === 0).toBe(true);
    // Joining a DIFFERENT site as a publisher, in one insert.
    const elsewhere = await makeSite();
    await denied(() =>
      as({ uid: me }, () =>
        sql("insert into lp_site_members (site_id, user_id, is_publisher) values ($1, $2, true)", [elsewhere, me]),
      ),
    );
  });

  it("TIDAK bisa mendaftarkan dirinya sebagai Agent situs mana pun", async () => {
    const me = await makeUser({ standing: "admin" });
    // The fixture is made OUTSIDE as(): made inside, the site insert itself
    // would be refused and the test would pass for the wrong reason.
    const site = await makeSite();
    await denied(() =>
      as({ uid: me }, () => sql("insert into lp_site_agents (site_id, user_id) values ($1, $2)", [site, me])),
    );
  });

  it("Agent melihat tautannya sendiri saja", async () => {
    const site = await makeSite();
    const a = await agentOf(site);
    const b = await agentOf(site);
    const { rows } = await as({ uid: a }, () =>
      sql<{ user_id: string }>("select user_id from lp_site_agents where site_id = $1", [site]),
    );
    expect(rows.map((r) => r.user_id)).toEqual([a]);
    expect(b).not.toBe(a);
  });
});
