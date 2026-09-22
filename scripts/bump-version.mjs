#!/usr/bin/env node
// Bump package.json's semver PATCH by one. The pre-commit hook (.githooks/
// pre-commit) runs this on every commit, so each commit carries a fresh version.
// Preserves 2-space formatting and a trailing newline so the diff is one line.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pkgPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json",
);

const raw = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(raw);

const parts = String(pkg.version ?? "").split(".");
if (parts.length !== 3 || parts.some((n) => !/^\d+$/.test(n))) {
  console.error(
    `bump-version: "${pkg.version}" is not a plain MAJOR.MINOR.PATCH version`,
  );
  process.exit(1);
}

const [maj, min, pat] = parts.map(Number);
pkg.version = `${maj}.${min}.${pat + 1}`;

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`version -> ${pkg.version}`);
