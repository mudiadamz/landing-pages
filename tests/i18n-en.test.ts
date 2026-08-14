import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { id } from "@/lib/i18n/id";

/**
 * The English dictionary against the Indonesian one.
 *
 * Key parity is already a compile error (`en` is typed `Record<keyof typeof id,
 * string>`), so the test for it here is cheap insurance against that type being
 * loosened later. The placeholder test is the one that earns its keep: `t()`
 * substitutes on the literal token `{count}`, so a translator who writes
 * `{jumlah}` — or drops the token while rephrasing — produces a string that
 * renders the placeholder to the user instead of the number. Nothing else
 * catches that; it type-checks, it builds, and it looks fine until the screen
 * says "{count} selected".
 */
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("english dictionary", () => {
  it("has exactly the same keys as Indonesian", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(id).sort());
  });

  it("has no blank values", () => {
    expect(Object.entries(en).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it("keeps every placeholder, spelled identically", () => {
    const broken: string[] = [];
    for (const [key, idValue] of Object.entries(id)) {
      const a = placeholders(idValue);
      const b = placeholders(en[key as keyof typeof id]);
      if (a.join() !== b.join()) broken.push(`${key}: id{${a}} vs en{${b}}`);
    }
    expect(broken).toEqual([]);
  });

  it("leaves no Indonesian behind in the English dictionary", () => {
    // A spot check, not a language detector: these are the words that appear in
    // nearly every string of the source dictionary, so a value that was pasted
    // across untranslated almost certainly contains one.
    const TELLS = /\b(yang|dan|untuk|tidak|dari|dengan|akan|bisa|sudah|pembeli|halaman)\b/i;
    const suspects = Object.entries(en)
      .filter(([, v]) => TELLS.test(v))
      .map(([k, v]) => `${k}: ${v}`);
    expect(suspects).toEqual([]);
  });

  it("renders through t() when asked for English", () => {
    expect(t("common.save", undefined, "en")).toBe("Save");
    expect(t("product.relatedSelected", { count: 3 }, "en")).toBe("3 selected");
  });

  it("still defaults to Indonesian", () => {
    // The default locale is not a detail to leave implicit: every existing call
    // site omits the argument, so a changed default silently switches the whole
    // site's language.
    expect(t("common.save")).toBe("Simpan");
  });
});
