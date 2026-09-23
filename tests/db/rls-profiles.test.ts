import { describe, expect, it } from "vitest";
import { as, denied, makeUser, makeUserWithoutProfile, sql } from "./sql";

/**
 * lp_profiles is where "who operates the platform" lives (is_platform, since
 * Fase 5 retired account_type), and where paid plans live (plan,
 * plan_expires_at). Both are protected by TWO independent
 * mechanisms, and only one of them is an RLS policy:
 *
 *   - RLS decides WHICH ROW you may touch (your own).
 *   - Column grants decide WHICH COLUMNS you may write in it.
 *
 * The UPDATE policy is `auth.uid() = id` with no column restriction at all. A
 * port that copies "the policies" and skips the grants hands every user the
 * keys to their own is_platform. These tests hold both halves.
 */

const PRIVILEGED = {
  is_platform: true,
  plan: "business",
  plan_expires_at: "2099-01-01T00:00:00Z",
  email_verified_at: "2026-01-01T00:00:00Z",
  is_active: false,
  exclude_from_stats: true,
} as const;

describe("lp_profiles — membaca", () => {
  it("user membaca profilnya sendiri", async () => {
    const me = await makeUser();
    const { rowCount } = await as({ uid: me }, () => sql("select id from lp_profiles where id = $1", [me]));
    expect(rowCount).toBe(1);
  });

  it("user TIDAK melihat profil orang lain", async () => {
    const me = await makeUser();
    const other = await makeUser();
    const { rowCount } = await as({ uid: me }, () => sql("select id from lp_profiles where id = $1", [other]));
    expect(rowCount).toBe(0);
  });

  it("anon tidak melihat profil siapa pun", async () => {
    const someone = await makeUser();
    const { rowCount } = await as("anon", () => sql("select id from lp_profiles where id = $1", [someone]));
    expect(rowCount).toBe(0);
  });

  it("Platform melihat profil siapa pun KECUALI operator Platform lain", async () => {
    // Sejak Fase 5 policy-nya "bukan is_platform", bukan "account_type =
    // customer": Platform memang menjalankan platformnya, dan daftar usernya
    // selalu memuat pengelola business juga. Yang tetap ditutup adalah akun yang
    // bisa membatalkan keputusannya — itu tetap butuh satu langkah sengaja.
    const platform = await makeUser({ standing: "platform" });
    const customer = await makeUser();
    const bizAdmin = await makeUser({ standing: "admin" });
    const otherPlatform = await makeUser({ standing: "platform" });
    const seen = await as({ uid: platform }, () =>
      sql<{ id: string }>("select id from lp_profiles where id = any($1)", [
        [customer, bizAdmin, otherPlatform],
      ]),
    );
    expect(seen.rows.map((r) => r.id).sort()).toEqual([customer, bizAdmin].sort());
  });
});

describe("lp_profiles — menulis barisnya sendiri", () => {
  it("boleh mengganti nama", async () => {
    const me = await makeUser();
    const { rowCount } = await as({ uid: me }, () =>
      sql("update lp_profiles set full_name = 'Nama baru' where id = $1", [me]),
    );
    expect(rowCount).toBe(1);
  });

  it("boleh mengganti dan menghapus avatar — lib/actions/profiles.ts melakukannya lewat client user", async () => {
    // avatar_url was added (20260809) AFTER the column lock-down (20260713) and
    // never granted, so this used to fail with "permission denied" — the avatar
    // upload landed in Storage and the profile never pointed at it.
    const me = await makeUser();
    const set = await as({ uid: me }, () =>
      sql("update lp_profiles set avatar_url = 'https://x.test/a.png' where id = $1", [me]),
    );
    const clear = await as({ uid: me }, () => sql("update lp_profiles set avatar_url = null where id = $1", [me]));
    expect([set.rowCount, clear.rowCount]).toEqual([1, 1]);
  });

  it.each(Object.entries(PRIVILEGED))("TIDAK boleh menulis %s sendiri", async (column, value) => {
    const me = await makeUser();
    await denied(() => as({ uid: me }, () => sql(`update lp_profiles set ${column} = $2 where id = $1`, [me, value])));
  });

  it("tidak bisa menyentuh baris orang lain sama sekali", async () => {
    const me = await makeUser();
    const other = await makeUser({ fullName: "Asli" });
    const { rowCount } = await as({ uid: me }, () =>
      sql("update lp_profiles set full_name = 'dibajak' where id = $1", [other]),
    );
    expect(rowCount).toBe(0);
  });

  it("tidak bisa menghapus profilnya sendiri", async () => {
    const me = await makeUser();
    const res = await as({ uid: me }, () => sql("delete from lp_profiles where id = $1", [me])).catch((e) => e);
    // Either refused outright or matched nothing — both leave the row.
    expect(res.code === "42501" || res.rowCount === 0).toBe(true);
  });
});

describe("lp_profiles — anon", () => {
  it.each(["full_name", ...Object.keys(PRIVILEGED)])("anon tidak bisa mengubah %s siapa pun", async (column) => {
    const victim = await makeUser();
    const value = column in PRIVILEGED ? PRIVILEGED[column as keyof typeof PRIVILEGED] : "x";
    const res = await as("anon", () =>
      sql(`update lp_profiles set ${column} = $2 where id = $1`, [victim, value]),
    ).catch((e) => e);
    expect(res.code === "42501" || res.rowCount === 0).toBe(true);
  });

  it("anon tidak memegang grant tulis apa pun di lp_profiles", async () => {
    // Belt and braces: RLS already turns anon's UPDATE into zero rows, but a
    // grant that is never meant to be used is one policy mistake away from
    // being used.
    const { rows } = await sql(
      `select privilege_type from information_schema.role_table_grants
        where table_name = 'lp_profiles' and grantee = 'anon'
          and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
       union
       select privilege_type from information_schema.column_privileges
        where table_name = 'lp_profiles' and grantee = 'anon'
          and privilege_type in ('INSERT','UPDATE')`,
    );
    expect(rows).toEqual([]);
  });
});

describe("lp_profiles — setiap kolom sudah diputuskan", () => {
  // The column grant is a LIST. A column added later is not writable by the
  // user until someone adds it — which is exactly how avatar_url broke for a
  // month. These two lists make the decision explicit: a new column fails this
  // test until it is put in one of them, and the grant made to match.
  const USER_UPDATES = ["avatar_url", "full_name"];
  const USER_INSERTS = ["full_name", "id"];
  const SERVICE_ONLY = [
    "business_id",
    "email",
    "email_verified_at",
    "exclude_from_stats",
    "id",
    "is_active",
    "is_platform",
    "plan",
    "plan_expires_at",
  ];

  it("tidak ada kolom yang belum masuk salah satu daftar", async () => {
    const { rows } = await sql<{ c: string }>(
      "select column_name as c from information_schema.columns where table_name = 'lp_profiles' order by 1",
    );
    const decided = new Set([...USER_UPDATES, ...SERVICE_ONLY]);
    expect(rows.map((r) => r.c).filter((c) => !decided.has(c))).toEqual([]);
  });

  it("grant authenticated persis sama dengan daftarnya", async () => {
    const grants = async (priv: string) =>
      (
        await sql<{ c: string }>(
          `select column_name as c from information_schema.column_privileges
            where table_name = 'lp_profiles' and grantee = 'authenticated' and privilege_type = $1
            order by 1`,
          [priv],
        )
      ).rows.map((r) => r.c);
    expect(await grants("UPDATE")).toEqual(USER_UPDATES);
    expect(await grants("INSERT")).toEqual(USER_INSERTS);
  });
});

describe("lp_profiles — membuat profil sendiri (fallback getProfile)", () => {
  // lib/actions/profiles.ts:getProfile inserts a row with the USER client when
  // none exists — an auth.users row created outside this app's signup path
  // (by hand, by an import, or before lp_handle_new_user existed). That path
  // must keep working, and must not be a way to be born an admin.

  it("boleh membuat profilnya sendiri dengan nama saja, dan BUKAN platform", async () => {
    const me = await makeUserWithoutProfile();
    await as({ uid: me }, () => sql("insert into lp_profiles (id, full_name) values ($1, 'Baru')", [me]));
    const { rows } = await sql("select is_platform, plan, email_verified_at from lp_profiles where id = $1", [me]);
    expect(rows[0]).toMatchObject({ is_platform: false, email_verified_at: null });
  });

  it.each(Object.entries(PRIVILEGED))("TIDAK boleh lahir dengan %s pilihan sendiri", async (column, value) => {
    const me = await makeUserWithoutProfile();
    await denied(() =>
      as({ uid: me }, () => sql(`insert into lp_profiles (id, ${column}) values ($1, $2)`, [me, value])),
    );
  });

  it("tidak bisa membuat profil untuk orang lain", async () => {
    const me = await makeUser();
    const other = await makeUserWithoutProfile();
    await denied(() => as({ uid: me }, () => sql("insert into lp_profiles (id) values ($1)", [other])));
  });
});

/**
 * The compatibility point (docs/plans/multi-business-saas.md, Fase 5).
 *
 * `account_type` is gone, but eleven policies still call
 * lp_get_my_profile_role() and compare against 'company' / 'agent'. The function
 * now DERIVES those three words instead of reading a column — so what these
 * tests pin is the mapping every one of those policies silently depends on.
 */
describe("lp_get_my_profile_role — diturunkan, bukan dibaca", () => {
  const roleOf = async (uid: string) =>
    (await as({ uid }, () => sql<{ r: string }>("select public.lp_get_my_profile_role() as r")))
      .rows[0].r;

  it("is_platform → 'company'", async () => {
    expect(await roleOf(await makeUser({ standing: "platform" }))).toBe("company");
  });

  it("owner & admin sebuah business → 'agent'", async () => {
    expect(await roleOf(await makeUser({ standing: "owner" }))).toBe("agent");
    expect(await roleOf(await makeUser({ standing: "admin" }))).toBe("agent");
  });

  it("staff → 'customer': dia bekerja di business, tidak mengelolanya", async () => {
    // Kalau staff ikut jadi 'agent', sebelas policy diam-diam memberinya hak
    // kelola yang tidak pernah diputuskan siapa pun.
    expect(await roleOf(await makeUser({ standing: "staff" }))).toBe("customer");
  });

  it("bukan anggota apa pun → 'customer'", async () => {
    expect(await roleOf(await makeUser())).toBe("customer");
  });

  it("kolom account_type memang sudah tidak ada", async () => {
    const { rowCount } = await sql(
      "select 1 from information_schema.columns where table_name = 'lp_profiles' and column_name = 'account_type'",
    );
    expect(rowCount).toBe(0);
  });
});
