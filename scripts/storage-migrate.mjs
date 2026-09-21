#!/usr/bin/env node
/**
 * Move files off Supabase Storage onto the server's disk, and point the
 * database at their new home. Part of fase 2/5 of docs/plans/remove-supabase.md.
 *
 *   node scripts/storage-migrate.mjs export  --supabase-url URL --service-key KEY --root DIR
 *   node scripts/storage-migrate.mjs rewrite --database-url PG --from OLD_ORIGIN --to NEW_ORIGIN [--apply]
 *
 * `export` talks to the Storage REST API with plain fetch — no SDK — so it
 * still works after @supabase/* is removed from the project. It copies every
 * object of every bucket to <root>/<bucket>/<path> (the layout lib/backend/
 * storage.ts reads), skips files already copied at the same size (so it can be
 * re-run for the delta inside the maintenance window), and ends by comparing
 * the object count and byte total per bucket. Any mismatch exits non-zero.
 *
 * `rewrite` replaces `<from>/storage/v1/object/public/` with
 * `<to>/storage/v1/object/public/` in EVERY text/varchar/jsonb column of every
 * lp_ table — found from the catalog, not listed by hand, so a column added
 * next month is covered too. Without --apply it only counts. With --apply it
 * runs in one transaction and then checks that no row still mentions <from>.
 */

import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// export
// ---------------------------------------------------------------------------

async function api(base, key, url, init = {}) {
  const res = await fetch(`${base}/storage/v1${url}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} → ${res.status} ${await res.text()}`);
  return res;
}

async function* walk(base, key, bucket, prefix = "") {
  for (let offset = 0; ; offset += 1000) {
    const res = await api(base, key, `/object/list/${bucket}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const items = await res.json();
    for (const item of items) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) yield* walk(base, key, bucket, name);
      else yield { name, size: Number(item.metadata?.size ?? 0) };
    }
    if (items.length < 1000) return;
  }
}

export async function exportObjects({ supabaseUrl, serviceKey, root, log = console.log }) {
  const base = supabaseUrl.replace(/\/$/, "");
  const buckets = await (await api(base, serviceKey, "/bucket")).json();
  const report = {};
  for (const b of buckets) {
    let count = 0;
    let bytes = 0;
    let copied = 0;
    for await (const obj of walk(base, serviceKey, b.id)) {
      const dest = path.join(root, b.id, ...obj.name.split("/"));
      const have = await stat(dest).catch(() => null);
      if (!have || have.size !== obj.size) {
        const res = await api(base, serviceKey, `/object/${b.id}/${obj.name.split("/").map(encodeURIComponent).join("/")}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, buf);
        copied++;
      }
      const onDisk = await stat(dest);
      if (onDisk.size !== obj.size) throw new Error(`ukuran tidak cocok: ${b.id}/${obj.name} (${onDisk.size} ≠ ${obj.size})`);
      count++;
      bytes += obj.size;
    }
    report[b.id] = { count, bytes, copied };
    log(`${b.id}: ${count} objek, ${bytes} byte (${copied} baru disalin)`);
  }
  return report;
}

// ---------------------------------------------------------------------------
// rewrite
// ---------------------------------------------------------------------------

export async function rewriteUrls({ db, from, to, apply = false, log = console.log }) {
  const oldPrefix = `${from.replace(/\/$/, "")}/storage/v1/object/public/`;
  const newPrefix = `${to.replace(/\/$/, "")}/storage/v1/object/public/`;
  const { rows: cols } = await db.query(`
    select c.table_name as t, c.column_name as c, c.data_type as type
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' and c.table_name like 'lp\\_%'
       and c.data_type in ('text', 'character varying', 'jsonb', 'json')
     order by 1, 2`);

  const q = (s) => `"${s.replace(/"/g, '""')}"`;
  const plan = [];
  for (const { t, c, type } of cols) {
    const asText = type.startsWith("json") ? `${q(c)}::text` : q(c);
    const { rows } = await db.query(`select count(*)::int as n from public.${q(t)} where ${asText} like $1`, [`%${oldPrefix}%`]);
    if (rows[0].n > 0) plan.push({ t, c, type, n: rows[0].n });
  }
  for (const p of plan) log(`${p.t}.${p.c}: ${p.n} baris`);
  if (!apply) return { plan, applied: false };

  await db.query("begin");
  try {
    for (const { t, c, type } of plan) {
      const expr = type.startsWith("json")
        ? `replace(${q(c)}::text, $1, $2)::${type}`
        : `replace(${q(c)}, $1, $2)`;
      const asText = type.startsWith("json") ? `${q(c)}::text` : q(c);
      await db.query(`update public.${q(t)} set ${q(c)} = ${expr} where ${asText} like $3`, [oldPrefix, newPrefix, `%${oldPrefix}%`]);
    }
    for (const { t, c, type } of plan) {
      const asText = type.startsWith("json") ? `${q(c)}::text` : q(c);
      const { rows } = await db.query(`select count(*)::int as n from public.${q(t)} where ${asText} like $1`, [`%${oldPrefix}%`]);
      if (rows[0].n !== 0) throw new Error(`${t}.${c} masih menyebut ${oldPrefix}`);
    }
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
  return { plan, applied: true };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const cmd = process.argv[2];
  try {
    if (cmd === "export") {
      await exportObjects({
        supabaseUrl: arg("supabase-url") ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey: arg("service-key") ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
        root: path.resolve(arg("root") ?? process.env.STORAGE_ROOT ?? ".storage"),
      });
    } else if (cmd === "rewrite") {
      const { default: pg } = await import("pg");
      const db = new pg.Client({ connectionString: arg("database-url") ?? process.env.DATABASE_URL });
      await db.connect();
      try {
        await rewriteUrls({ db, from: arg("from"), to: arg("to"), apply: process.argv.includes("--apply") });
      } finally {
        await db.end();
      }
    } else {
      console.error("pakai: storage-migrate.mjs export|rewrite …  (lihat komentar di atas file)");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

export const _hash = (b) => createHash("sha256").update(b).digest("hex");
