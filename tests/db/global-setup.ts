import pg from "pg";
import type { TestProject } from "vitest/node";
import { migrate } from "../../scripts/migrate.mjs";

/**
 * Runs once before `pnpm test:db`: builds a database from nothing, on plain
 * Postgres (docs/plans/remove-supabase.md, fase 4).
 *
 * Every run drops and recreates `lp_test`, then applies db/migrations with the
 * same runner production uses. So the suite never runs against a schema that
 * is behind the files (the old setup had to refuse that case), and it proves on
 * every run that the migrations alone produce a working database — no
 * Supabase, no hand-made state.
 *
 * Two URLs are handed to the tests:
 * - `dbUrl`    — the owner. Fixtures, and the SQL harness that switches roles.
 * - `appDbUrl` — the `app` role, with exactly the rights production gives the
 *   application. Code under test (lib/backend) connects as this, so a missing
 *   grant fails here instead of in production.
 *
 * TEST_DATABASE_URL points at the server (any database on it; default: the
 * container from compose.dev.yml).
 */

declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string;
    appDbUrl: string;
  }
}

/** Same as .env.development.local — roles belong to the server, so dev and tests share it. */
const APP_PASSWORD = "app";

export default async function setup(project: TestProject) {
  const server = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/postgres");

  const admin = new pg.Client({ connectionString: server.toString() });
  try {
    await admin.connect();
  } catch (e) {
    throw new Error(
      `Postgres tes tidak bisa dihubungi (${server.host}). Nyalakan dulu:\n` +
        "  docker compose -f compose.dev.yml up -d\n" +
        `(${e instanceof Error ? e.message : e})`,
    );
  }
  try {
    await admin.query("drop database if exists lp_test with (force)");
    await admin.query("create database lp_test");
  } finally {
    await admin.end();
  }

  const dbUrl = new URL(server);
  dbUrl.pathname = "/lp_test";
  // The same call the `migrate` service makes in production, password included
  // (the baseline creates `app` without a login — no password belongs in git).
  await migrate(dbUrl.toString(), { log: () => undefined, appPassword: APP_PASSWORD });

  const appDbUrl = new URL(dbUrl);
  appDbUrl.username = "app";
  appDbUrl.password = APP_PASSWORD;

  project.provide("dbUrl", dbUrl.toString());
  project.provide("appDbUrl", appDbUrl.toString());
}
