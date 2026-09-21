#!/usr/bin/env node
/**
 * Cutover, step 1: bring the Supabase database up to the schema the baseline
 * was dumped from, so its DATA fits the new database column for column.
 * (docs/runbooks/cutover-supabase.md)
 *
 *   node scripts/supabase-catch-up.mjs "$SUPABASE_DB_URL"           # list only
 *   node scripts/supabase-catch-up.mjs "$SUPABASE_DB_URL" --apply   # apply
 *
 * Applies, in order, every file in db/migrations/_archive whose version is not
 * yet in supabase_migrations.schema_migrations — what `supabase db push` did,
 * without the CLI (the files no longer live where it looks). One transaction
 * per file, recorded in the same table, so `supabase migration list` still
 * reads true afterwards.
 *
 * This WRITES to the production Supabase project. It is Adam's step to run.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const ARCHIVE = "db/migrations/_archive";
const [url] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");
if (!url) {
  console.error('pakai: supabase-catch-up.mjs "$SUPABASE_DB_URL" [--apply]');
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const applied = new Set(
    (await client.query("select version from supabase_migrations.schema_migrations")).rows.map((r) => r.version),
  );
  const missing = readdirSync(ARCHIVE)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .filter((f) => !applied.has(f.split("_")[0]));

  if (!missing.length) {
    console.log("Supabase sudah setara baseline — tidak ada yang perlu diterapkan.");
    process.exit(0);
  }
  for (const f of missing) {
    if (!apply) {
      console.log(`belum: ${f}`);
      continue;
    }
    const version = f.split("_")[0];
    const name = f.slice(version.length + 1, -".sql".length);
    await client.query("begin");
    try {
      await client.query(readFileSync(path.join(ARCHIVE, f), "utf8"));
      await client.query("insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)", [version, name]);
      await client.query("commit");
      console.log(`diterapkan: ${f}`);
    } catch (e) {
      await client.query("rollback");
      throw new Error(`${f}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!apply) console.log(`\n${missing.length} migration belum diterapkan. Ulangi dengan --apply.`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
