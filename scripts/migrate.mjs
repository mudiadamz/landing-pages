#!/usr/bin/env node
/**
 * Apply db/migrations/*.sql in order, each once (docs/plans/remove-supabase.md,
 * fase 4). Replaces `supabase migration up`.
 *
 *   node scripts/migrate.mjs                 # DATABASE_URL (or MIGRATE_DATABASE_URL)
 *   node scripts/migrate.mjs --status        # list, apply nothing
 *   node scripts/migrate.mjs --seed          # then db/seed.sql (dev only; idempotent)
 *
 * Runs as the database OWNER, not as `app`: migrations create and grant, the app
 * only reads and writes. Use MIGRATE_DATABASE_URL when DATABASE_URL is the app
 * role.
 *
 * Each file runs in its own transaction together with the row that records it,
 * so a failed migration leaves neither half behind. Files already recorded are
 * skipped by version (the timestamp before the first `_`); a recorded version
 * whose file has since CHANGED is an error — editing a migration that has run
 * somewhere means that somewhere now differs from a fresh install.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const DIR = path.resolve(process.env.MIGRATIONS_DIR ?? "db/migrations");

export function migrationFiles(dir = DIR) {
  return readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((f) => {
      const sql = readFileSync(path.join(dir, f), "utf8");
      return { version: f.split("_")[0], name: f, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

export async function migrate(connectionString, { dir = DIR, log = console.log, statusOnly = false } = {}) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      create schema if not exists migrations;
      create table if not exists migrations.applied (
        version text primary key,
        name text not null,
        checksum text not null,
        applied_at timestamptz not null default now()
      );
      revoke all on schema migrations from public;`);
    // One runner at a time (two deploys racing): a session-level advisory lock.
    await client.query("select pg_advisory_lock(hashtext('lp-migrate'))");

    const done = new Map(
      (await client.query("select version, name, checksum from migrations.applied")).rows.map((r) => [r.version, r]),
    );
    const applied = [];
    for (const m of migrationFiles(dir)) {
      const prev = done.get(m.version);
      if (prev) {
        if (prev.checksum !== m.checksum) {
          throw new Error(`${m.name} sudah diterapkan tapi isinya berubah sejak itu. Buat migration baru, jangan ubah yang lama.`);
        }
        continue;
      }
      if (statusOnly) {
        log(`belum: ${m.name}`);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(m.sql);
        await client.query("insert into migrations.applied (version, name, checksum) values ($1, $2, $3)", [
          m.version,
          m.name,
          m.checksum,
        ]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw new Error(`${m.name}: ${e instanceof Error ? e.message : e}`);
      }
      applied.push(m.name);
      log(`diterapkan: ${m.name}`);
    }
    if (!applied.length && !statusOnly) log("database sudah terbaru");
    return applied;
  } finally {
    await client.end();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("MIGRATE_DATABASE_URL atau DATABASE_URL harus diisi.");
    process.exit(2);
  }
  migrate(url, { statusOnly: process.argv.includes("--status") })
    .then(async () => {
      if (!process.argv.includes("--seed")) return;
      const client = new pg.Client({ connectionString: url });
      await client.connect();
      try {
        await client.query(readFileSync("db/seed.sql", "utf8"));
        console.log("seed diterapkan");
      } finally {
        await client.end();
      }
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
