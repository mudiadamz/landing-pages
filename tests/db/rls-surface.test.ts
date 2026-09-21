import { describe, expect, it } from "vitest";
import { sql } from "./sql";

/**
 * The whole security surface, pinned.
 *
 * The behavioural tests next to this file say what each role can DO. This one
 * says what the surface IS: every policy, every non-default grant, every
 * SECURITY DEFINER function. Any change to it shows up as a snapshot diff in
 * review — deliberate changes are one `vitest -u` away, accidental ones do not
 * slip through as "just a migration".
 *
 * It is also the porting checklist: if Supabase is ever replaced, the snapshot
 * is the exact list of rules the replacement has to reproduce, including the
 * ones that are grants rather than policies (lp_profiles, lp_landing_pages).
 */

describe("permukaan keamanan", () => {
  // storage.objects dropped out in fase 4: those rules live in
  // lib/backend/storage.ts now (tests/db/storage-own.test.ts).
  it("setiap policy di tabel lp_", async () => {
    const { rows } = await sql(
      `select tablename, policyname, cmd, array_to_string(roles, ',') as roles,
              coalesce(qual, '') as using, coalesce(with_check, '') as check
         from pg_policies
        where schemaname = 'public' and tablename like 'lp\\_%'
        order by tablename, policyname`,
    );
    expect(rows).toMatchSnapshot();
  });

  it("grant tulis per kolom untuk authenticated (tabel yang tidak full-grant)", async () => {
    const { rows } = await sql(
      `select table_name, privilege_type, string_agg(column_name, ',' order by column_name) as columns
         from information_schema.column_privileges cp
        where table_schema = 'public' and table_name like 'lp\\_%'
          and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
          and not exists (
            select 1 from information_schema.role_table_grants g
             where g.table_name = cp.table_name and g.grantee = 'authenticated'
               and g.privilege_type = cp.privilege_type)
        group by table_name, privilege_type
        order by table_name, privilege_type`,
    );
    expect(rows).toMatchSnapshot();
  });

  it("fungsi SECURITY DEFINER milik lp_", async () => {
    const { rows } = await sql(
      `select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and p.proname like 'lp\\_%'
        order by 1, 2`,
    );
    expect(rows).toMatchSnapshot();
  });

  it("setiap fungsi SECURITY DEFINER lp_ mematok search_path", async () => {
    // A definer function resolves unqualified names through the CALLER's
    // search_path while running with the owner's rights; a caller who can put a
    // schema in front of `public` can swap in their own table or function.
    const { rows } = await sql<{ name: string }>(
      `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as name
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and p.proname like 'lp\\_%'
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
        order by 1`,
    );
    expect(rows.map((r) => r.name)).toEqual([]);
  });
});
