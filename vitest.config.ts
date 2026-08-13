import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Unit tests only — no dev server, no database, no network.
 *
 * The things worth testing here are the pure decisions: what counts as safe
 * HTML, how much of a book a preview shows, which stored font size a reader
 * gets after a rebase. Those were all verified by hand at some point, which
 * means they were verified once. This is the version that keeps checking.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // A test that reaches the network is not a unit test; failing fast on it is
    // cheaper than debugging a flake at 2am.
    testTimeout: 5000,
  },
});
