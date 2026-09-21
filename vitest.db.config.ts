import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Tests that talk to a real Postgres — plain postgres:17, the container in
 * compose.dev.yml (:54329). Run with `pnpm test:db` after `pnpm db:up`; the
 * global setup builds a fresh `lp_test` database from db/migrations each run.
 *
 * Why this exists at all: the pure suite (`pnpm test`) stayed green through a
 * migration that broke every signup, because not one of its tests touched a
 * database. See docs/plans/test-before-leaving-supabase.md.
 *
 * These tests pin behaviour, not implementation. They are written from the
 * attacker's side — "can this role read that row?" — so that they keep meaning
 * something if the backend under them is ever replaced.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/global-setup.ts"],
    // One file at a time. SQL tests run inside a transaction that is rolled
    // back, but two files inserting the same unique value concurrently would
    // block on each other's uncommitted row; the auth and storage tests commit
    // for real.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
