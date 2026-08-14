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


  /**
   * Keys that exist but nothing calls yet — screens still holding their own
   * hardcoded copy of the string.
   *
   * This is a backlog, not an exemption. Each entry names a surface that has
   * not been converted: the analytics dashboard, the sites manager, the
   * checkout/preview buttons, the theme switch. When one of those is converted
   * its key stops being unused and must be deleted from this list, which is why
   * the test fails on a stale entry as well as on a new one.
   */
  const NOT_YET_CONVERTED = [
    "analytics.entryPage",
    "analytics.noUtm",
    "analytics.product",
    "analytics.sessions",
    "checkout.buyNow",
    "checkout.getFree",
    "common.add",
    "common.all",
    "common.edit",
    "common.free",
    "common.price",
    "common.required",
    "common.search",
    "home.themeToggle",
    "nav.categories",
    "nav.home",
    "nav.profile",
    "panel.socialHint",
    "reader.signInGoogle",
    "sites.domain",
    "sites.inactive",
  ];

  it("has no unused keys beyond the declared backlog", () => {
    // The other direction of the missing-key test. A key with no caller is
    // usually the residue of a half-finished move: the string was added to the
    // dictionary and the component kept its hardcoded copy, so the translation
    // exists and nothing renders it.
    const used = new Set<string>();
    for (const file of files) {
      if (file.endsWith(join("lib", "i18n", "id.ts"))) continue;
      for (const [, key] of readFileSync(file, "utf8").matchAll(CALL)) used.add(key);
    }
    const unused = Object.keys(id).filter((k) => !used.has(k));
    expect(unused.sort()).toEqual([...NOT_YET_CONVERTED].sort());
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
    // The public footer link vs the panel tab that edits it. A translator may
    // well want the visitor-facing word and the editor's word to differ.
    Ketentuan: ["nav.terms", "content.tabLegal"],
    // One is a placeholder ("Judul halaman"), the other a field label. Same
    // words today, different jobs — and placeholders often shorten first.
    "Judul halaman": ["panel.pageTitlePlaceholder", "content.pageTitle"],
    // The checkout's back link and the 404's home link say the same thing in
    // Indonesian. In English one is "Go to homepage" in both places too — but
    // they sit in different sentences, so they stay separately translatable.
    "Ke beranda": ["notFound.home", "common.toHome"],
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
