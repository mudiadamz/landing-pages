#!/usr/bin/env node
/**
 * Second half of scripts/restore-drill.sh: is the restored database the same
 * database, and does its security still hold?
 *
 *   node scripts/restore-verify.mjs <RESTORED_URL> [SOURCE_URL] [--ignore a.b,c.d]
 *
 * --ignore: tables not expected to match (after a cutover import, app_auth.*
 * — sessions are deliberately not carried over).
 *
 * - Row counts of every lp_ table, auth.users, auth.identities and app_auth.*
 *   — compared one by one with the source when it is given.
 * - The migration record: nothing in db/migrations may be pending.
 * - RLS: as `anon` no profile is visible; `service_role` sees them all.
 */
import pg from "pg";
import { migrationFiles } from "./migrate.mjs";

const args = process.argv.slice(2);
const ignoreAt = args.indexOf("--ignore");
const ignored = new Set(ignoreAt >= 0 ? args.splice(ignoreAt, 2)[1].split(",") : []);
const [target, source] = args;
if (!target) {
  console.error("pakai: restore-verify.mjs <RESTORED_URL> [SOURCE_URL]");
  process.exit(2);
}

async function counts(url) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const { rows } = await c.query(`
      select schemaname || '.' || tablename as t from pg_tables
       where (schemaname = 'public' and tablename like 'lp\\_%')
          or (schemaname = 'auth' and tablename in ('users', 'identities'))
          or schemaname = 'app_auth'
       order by 1`);
    const out = {};
    for (const { t } of rows) out[t] = Number((await c.query(`select count(*) from ${t}`)).rows[0].count);
    return out;
  } finally {
    await c.end();
  }
}

let failed = false;
const fail = (m) => {
  console.error(`✗ ${m}`);
  failed = true;
};

const restored = await counts(target);
const original = source ? await counts(source) : null;
for (const [t, n] of Object.entries(restored)) {
  const want = original?.[t];
  if (original && want !== n && !ignored.has(t)) fail(`${t}: ${n} baris, sumber ${want ?? "(tidak ada)"}`);
  else console.log(`  ${t.padEnd(40)} ${n}`);
}
if (original) for (const t of Object.keys(original)) if (!(t in restored) && !ignored.has(t)) fail(`${t} tidak ada di hasil restore`);

const c = new pg.Client({ connectionString: target });
await c.connect();
try {
  const applied = new Set((await c.query("select version from migrations.applied")).rows.map((r) => r.version));
  const pending = migrationFiles().filter((m) => !applied.has(m.version));
  if (pending.length) fail(`migration belum tercatat: ${pending.map((m) => m.name).join(", ")}`);

  await c.query("begin");
  await c.query("set local role anon");
  const anon = Number((await c.query("select count(*) from lp_profiles")).rows[0].count);
  await c.query("rollback");
  if (anon !== 0) fail(`anon melihat ${anon} profil — RLS tidak berlaku`);

  await c.query("begin");
  await c.query("set local role service_role");
  const all = Number((await c.query("select count(*) from lp_profiles")).rows[0].count);
  await c.query("rollback");
  if (all !== restored["public.lp_profiles"]) fail(`service_role melihat ${all} profil dari ${restored["public.lp_profiles"]}`);
} finally {
  await c.end();
}

if (failed) process.exit(1);
console.log(`✓ restore cocok${source ? " dengan sumbernya" : ""}: ${Object.keys(restored).length} tabel, RLS berlaku, tidak ada migration tertinggal`);
