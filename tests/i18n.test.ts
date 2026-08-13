import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { id } from "@/lib/i18n/id";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("t()", () => {
  it("returns the string for a known key", () => {
    expect(t("common.save")).toBe("Simpan");
  });

  it("substitutes named variables", () => {
    expect(t("product.relatedSelected", { count: 3 })).toBe("3 dipilih");
  });

  it("leaves an unknown placeholder alone rather than printing undefined", () => {
    expect(t("product.relatedSelected", {})).toContain("{count}");
  });

  it("returns the key itself when it is missing, so the bug is visible", () => {
    // @ts-expect-error deliberately unknown key
    expect(t("nope.missing")).toBe("nope.missing");
  });
});

/**
 * The check that used to be a shell one-liner I re-ran by hand — and got wrong
 * once, with a regex that matched every call ending in `t(` and reported 158
 * false positives. Encoded here so it runs on its own and cannot be misread.
 */
describe("dictionary integrity", () => {
  const CALL = /(?<![A-Za-z0-9_$.])t\("([^"]+)"/g;
  const files = [...walk("app"), ...walk("components"), ...walk("lib")];

  it("every key used in the codebase exists in the dictionary", () => {
    const missing: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const [, key] of src.matchAll(CALL)) {
        if (!(key in id)) missing.push(`${key} (${file})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("has no blank values", () => {
    const blank = Object.entries(id).filter(([, v]) => !String(v).trim());
    expect(blank).toEqual([]);
  });

  /**
   * Two keys with the same text are sometimes right and sometimes an accident.
   *
   * "Nama situs" is both an external link's name and the storefront's own name —
   * same words in Indonesian, different things, and a translator may need them
   * to diverge. So identical values are allowed only when someone has said so
   * here; a NEW duplicate fails, which is the case actually worth catching.
   */
  const INTENTIONAL_DUPLICATES: Record<string, string[]> = {
    Harga: ["common.price", "product.tabPrice"],
    Kategori: ["common.category", "nav.categories"],
    "Cari produk…": ["home.searchPlaceholder", "product.relatedSearch"],
    "Cari produk": ["home.searchLabel", "home.searchOpen"],
    "Link lainnya": ["home.otherLinks", "panel.tabOther"],
    Preview: ["checkout.preview", "product.tabPreview"],
    "Nama situs": ["panel.linkName", "sites.siteName"],
  };

  it("has no UNDECLARED duplicate values", () => {
    const byValue = new Map<string, string[]>();
    for (const [k, v] of Object.entries(id)) {
      byValue.set(v, [...(byValue.get(v) ?? []), k]);
    }
    const undeclared = [...byValue.entries()]
      .filter(([, keys]) => keys.length > 1)
      .filter(([value, keys]) => {
        const allowed = INTENTIONAL_DUPLICATES[value];
        return !allowed || [...keys].sort().join() !== [...allowed].sort().join();
      });
    expect(undeclared).toEqual([]);
  });
});
