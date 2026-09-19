import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import pg from "pg";
import type { TestProject } from "vitest/node";

/**
 * Runs once before `pnpm test:db`. Two jobs:
 *
 * 1. Refuse to run against a database that is BEHIND the migration files. The
 *    local DB only moves when someone runs `migration up`; a `git pull` does not
 *    touch it. Tests against a stale schema pass or fail for reasons that have
 *    nothing to do with the code under test — the worst kind of result.
 *
 * 2. Hand the stack's URLs and keys to the tests. They come from
 *    `supabase status`, not from a committed file, because the local keys are
 *    the CLI's to decide.
 */

declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string;
    apiUrl: string;
    anonKey: string;
    serviceRoleKey: string;
  }
}

function stackEnv(): Record<string, string> {
  let out: string;
  try {
    // The CLI binary directly, not `pnpm exec`: pnpm may decide the install is
    // stale and try to reinstall first, which fails without a TTY and would be
    // reported here as "the stack is down".
    out = execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const detail = (e as { stderr?: string }).stderr?.trim().split("\n").slice(-2).join(" ") ?? "";
    throw new Error(
      "Stack Supabase lokal tidak jalan. Nyalakan dulu:\n" +
        "  colima start && pnpm exec supabase start -x vector,logflare && pnpm exec supabase migration up --local\n" +
        (detail ? `(supabase status: ${detail})` : ""),
    );
  }
  const env: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export default async function setup(project: TestProject) {
  const env = stackEnv();
  const dbUrl = process.env.TEST_DATABASE_URL ?? env.DB_URL;
  if (!dbUrl || !env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
    throw new Error("`supabase status -o env` tidak memberi DB_URL/API_URL/ANON_KEY/SERVICE_ROLE_KEY.");
  }

  const newest = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.split("_")[0])
    .sort()
    .at(-1);

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ v: string | null }>(
      "select max(version) as v from supabase_migrations.schema_migrations",
    );
    const applied = rows[0]?.v ?? "";
    if (applied < (newest ?? "")) {
      throw new Error(
        `Database lokal tertinggal: migration terbaru yang diterapkan ${applied || "(tidak ada)"}, ` +
          `file terbaru ${newest}. Jalankan: pnpm exec supabase migration up --local`,
      );
    }
  } finally {
    await client.end();
  }

  // 3. The running GoTrue must behave like production where the app depends on
  //    it. Containers keep the config they were CREATED with: a stack started
  //    in June kept confirming e-mails for months after config.toml turned that
  //    off to mirror production, so signups here returned no session while in
  //    production they did. `supabase start` alone does not fix it — the
  //    containers must be recreated.
  const settings = (await fetch(`${env.API_URL}/auth/v1/settings`, {
    headers: { apikey: env.ANON_KEY },
  }).then((r) => r.json())) as { mailer_autoconfirm?: boolean };
  if (settings.mailer_autoconfirm !== true) {
    throw new Error(
      "GoTrue lokal masih meminta konfirmasi email (mailer_autoconfirm=false), beda dengan produksi dan " +
        "supabase/config.toml. Container-nya dibuat dengan config lama; buat ulang:\n" +
        "  pnpm exec supabase stop && pnpm exec supabase start -x vector,logflare",
    );
  }

  project.provide("dbUrl", dbUrl);
  project.provide("apiUrl", env.API_URL);
  project.provide("anonKey", env.ANON_KEY);
  project.provide("serviceRoleKey", env.SERVICE_ROLE_KEY);
}
