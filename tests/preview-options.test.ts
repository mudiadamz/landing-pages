import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PREVIEW_OPTIONS } from "@/app/panel/product/[id]/edit/preview-options";

/**
 * The preview picker has to offer every preview mode the database accepts.
 *
 * PreviewType is a TypeScript union, so nothing at runtime knows its members —
 * which is exactly why the list and the type can drift. A mode added to the
 * union but not to PREVIEW_OPTIONS typechecks perfectly and simply cannot be
 * chosen in the panel; a mode dropped from the union but left in the list
 * offers an option that fails on save.
 *
 * So the test reads the union out of the source. It is a slightly unusual thing
 * for a test to do, and the alternative is a second hand-maintained copy of the
 * members here — which would drift in its own right, silently, and take the
 * test's word for it.
 */
const SOURCE = "lib/actions/landing-pages.ts";

function previewTypesFromSource(): string[] {
  const src = readFileSync(SOURCE, "utf8");
  const decl = /export type PreviewType\s*=\s*([^;]+);/.exec(src);
  if (!decl) throw new Error(`PreviewType not found in ${SOURCE} — did it move?`);
  return [...decl[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("PREVIEW_OPTIONS", () => {
  it("offers exactly the modes PreviewType allows", () => {
    expect([...PREVIEW_OPTIONS.map((o) => o.value)].sort()).toEqual(
      previewTypesFromSource().sort(),
    );
  });

  it("has no duplicate values", () => {
    const values = PREVIEW_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every mode a label and a hint", () => {
    // The hint is the only place the difference between "deliverable" and
    // "excerpt" is explained. An empty one is a mode nobody can choose between.
    for (const opt of PREVIEW_OPTIONS) {
      expect(opt.label.trim(), `label for ${opt.value}`).not.toBe("");
      expect(opt.hint.trim().length, `hint for ${opt.value}`).toBeGreaterThan(20);
    }
  });

  it("lists html first", () => {
    // The default for a new product, and the one a first-time user should meet
    // before the two that depend on having uploaded a deliverable.
    expect(PREVIEW_OPTIONS[0].value).toBe("html");
  });
});
