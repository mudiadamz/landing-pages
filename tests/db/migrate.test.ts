import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { migrate } from "../../scripts/migrate.mjs";

/**
 * scripts/migrate.mjs, the runner that replaced `supabase migration up`, on a
 * scratch database of its own. (That it builds the real schema is proven by
 * every other file in this suite: global-setup uses it.)
 */

let dir: string;
let url: string;
let admin: pg.Client;

const quiet = { log: () => undefined };
const write = (name: string, sql: string) => writeFileSync(path.join(dir, name), sql);
async function tables(): Promise<string[]> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const { rows } = await c.query("select tablename from pg_tables where schemaname = 'public' order by 1");
  await c.end();
  return rows.map((r) => r.tablename);
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "lp-migrate-"));
  admin = new pg.Client({ connectionString: inject("dbUrl") });
  await admin.connect();
  await admin.query("drop database if exists lp_migrate_test with (force)");
  await admin.query("create database lp_migrate_test");
  const u = new URL(inject("dbUrl"));
  u.pathname = "/lp_migrate_test";
  url = u.toString();
});

afterAll(async () => {
  await admin.query("drop database if exists lp_migrate_test with (force)");
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
});

describe("migrate.mjs", () => {
  it("menerapkan berurutan, sekali saja", async () => {
    write("20260101000000_a.sql", "create table a (id int primary key);");
    write("20260102000000_b.sql", "create table b (id int references a(id));");
    expect(await migrate(url, { dir, ...quiet })).toEqual(["20260101000000_a.sql", "20260102000000_b.sql"]);
    expect(await migrate(url, { dir, ...quiet })).toEqual([]);
    expect(await tables()).toEqual(["a", "b"]);
  });

  it("file yang gagal tidak meninggalkan apa pun — tidak setengah, tidak tercatat", async () => {
    write("20260103000000_c.sql", "create table c (id int); select 1/0;");
    await expect(migrate(url, { dir, ...quiet })).rejects.toThrow(/20260103000000_c\.sql/);
    expect(await tables()).toEqual(["a", "b"]);
    write("20260103000000_c.sql", "create table c (id int);");
    expect(await migrate(url, { dir, ...quiet })).toEqual(["20260103000000_c.sql"]);
  });

  it("migration yang sudah jalan lalu diubah → ditolak", async () => {
    write("20260101000000_a.sql", "create table a (id int, extra text);");
    await expect(migrate(url, { dir, ...quiet })).rejects.toThrow(/berubah/);
  });
});
