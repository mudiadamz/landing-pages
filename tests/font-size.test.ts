import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Type sizes must be RELATIVE, so the device wins.
 *
 * A size in `px` is a size the reader cannot change: raising the browser's or
 * the phone's font setting rescales `rem` and `em` and leaves `px` exactly where
 * it was, so a page built out of pixels stays small for the people who asked for
 * it not to be. Every size in this codebase is therefore rem/em — including the
 * arbitrary Tailwind values, which is what this test watches, because
 * `text-[11px]` is the one that is easy to type without noticing.
 *
 * At the default 16px root these render identically to the pixel values they
 * replaced. The difference only appears once someone has changed the setting,
 * which is the entire point.
 */
const PX_TEXT = /text-\[[0-9]*\.?[0-9]+px\]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("font sizes follow the device", () => {
  it("uses no px font size anywhere in the app", () => {
    const offenders: string[] = [];
    for (const file of walk(process.cwd())) {
      // This file names the pattern in its own prose, so it would report itself.
      if (file.endsWith("tests/font-size.test.ts")) continue;
      const source = readFileSync(file, "utf8");
      for (const hit of source.match(PX_TEXT) ?? []) {
        offenders.push(`${file.replace(process.cwd() + "/", "")}: ${hit}`);
      }
    }
    // Named in full rather than counted: a count tells the next person that
    // something broke, the list tells them where.
    expect(offenders).toEqual([]);
  });
});
