import { pool } from "./pool";

/**
 * What the query builder needs to know about the database, read once.
 *
 * - Foreign keys: to resolve an embedded resource (`lp_chat_attachments(…)`,
 *   `landing_pages:lp_landing_pages!purchases_landing_page_id_fkey(…)`) into a
 *   join, the way PostgREST does — many-to-one gives an object, one-to-many an
 *   array, and a `!hint` names the constraint when two FKs point the same way.
 * - Column types: only to know which columns are json/jsonb, whose filter
 *   values must be sent as JSON text rather than as a Postgres array literal.
 * - Primary keys: the default ON CONFLICT target for `upsert` without
 *   `onConflict`, as in PostgREST.
 * - Function return types: `void` RPCs answer `null`.
 */

export type ForeignKey = {
  name: string;
  from: string;
  fromCols: string[];
  to: string;
  toCols: string[];
};

export type Schema = {
  fks: ForeignKey[];
  jsonCols: Map<string, Set<string>>;
  pks: Map<string, string[]>;
  voidFns: Set<string>;
};

declare global {
  var __lpSchema: Promise<Schema> | undefined;
}

async function load(): Promise<Schema> {
  const db = pool();
  const [fks, cols, pks, fns] = await Promise.all([
    db.query<{ name: string; from: string; to: string; from_cols: string[]; to_cols: string[] }>(`
      select c.conname as name, f.relname as from, t.relname as to,
             array(select a.attname from unnest(c.conkey) with ordinality k(n, i)
                     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n order by k.i)::text[] as from_cols,
             array(select a.attname from unnest(c.confkey) with ordinality k(n, i)
                     join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n order by k.i)::text[] as to_cols
        from pg_constraint c
        join pg_class f on f.oid = c.conrelid join pg_namespace fn on fn.oid = f.relnamespace
        join pg_class t on t.oid = c.confrelid join pg_namespace tn on tn.oid = t.relnamespace
       where c.contype = 'f' and fn.nspname = 'public' and tn.nspname = 'public'`),
    db.query<{ table_name: string; column_name: string }>(`
      select table_name, column_name from information_schema.columns
       where table_schema = 'public' and data_type in ('json', 'jsonb')`),
    db.query<{ table: string; cols: string[] }>(`
      select t.relname as table,
             array(select a.attname from unnest(c.conkey) with ordinality k(n, i)
                     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n order by k.i)::text[] as cols
        from pg_constraint c join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
       where c.contype = 'p' and n.nspname = 'public'`),
    db.query<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prorettype = 'void'::regtype`),
  ]);

  const jsonCols = new Map<string, Set<string>>();
  for (const r of cols.rows) {
    if (!jsonCols.has(r.table_name)) jsonCols.set(r.table_name, new Set());
    jsonCols.get(r.table_name)!.add(r.column_name);
  }
  return {
    fks: fks.rows.map((r) => ({ name: r.name, from: r.from, fromCols: r.from_cols, to: r.to, toCols: r.to_cols })),
    jsonCols,
    pks: new Map(pks.rows.map((r) => [r.table, r.cols])),
    voidFns: new Set(fns.rows.map((r) => r.proname)),
  };
}

export function schema(): Promise<Schema> {
  if (!globalThis.__lpSchema) {
    globalThis.__lpSchema = load().catch((e) => {
      // Do not cache a failure: the next query tries again.
      globalThis.__lpSchema = undefined;
      throw e;
    });
  }
  return globalThis.__lpSchema;
}

/** Forget the cached schema — after a migration, in tests. */
export function resetSchema(): void {
  globalThis.__lpSchema = undefined;
}
