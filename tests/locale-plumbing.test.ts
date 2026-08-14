import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_LOCALE, normalizeLocale, translator } from "@/lib/i18n";
import { LOCALE_OPTIONS } from "@/lib/i18n/locales";
import { siteBrand } from "@/lib/site-brand";
import type { Site } from "@/lib/site-resolve";

const MIGRATION = "supabase/migrations/20260814000000_site_locale.sql";

const SITE: Site = {
  id: "site-1",
  host: "example.com",
  name: "Example",
  tagline: null,
  description: null,
  category_ids: [],
  template: "linkbio",
  palette: "forest",
  logo_url: null,
  icon_url: null,
  is_canonical: false,
  active: true,
  locale: "en",
};

describe("normalizeLocale", () => {
  it("passes through a locale we ship", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("id")).toBe("id");
  });

  it("falls back for anything else", () => {
    // The row arrives from Supabase as an unchecked cast, and a deployment
    // running ahead of its migration gets undefined. Neither should render a
    // storefront full of raw message keys.
    for (const bad of [undefined, null, "", "fr", "EN", 7, {}]) {
      expect(normalizeLocale(bad)).toBe(DEFAULT_LOCALE);
    }
  });
});

describe("translator", () => {
  it("binds the locale so call sites stay unchanged", () => {
    const t = translator("en");
    expect(t("common.save")).toBe("Save");
    expect(t("product.slotsLeft", { count: 2 })).toBe("2 slots left");
  });

  it("defaults to Indonesian when given nothing", () => {
    expect(translator()("common.save")).toBe("Simpan");
  });
});

describe("siteBrand", () => {
  it("carries the locale to client chrome", () => {
    // The header and footer are client components that cannot resolve the site
    // themselves; if the brand loses the locale they silently render the
    // default language on someone else's domain.
    expect(siteBrand(SITE).locale).toBe("en");
  });
});

describe("locale picker", () => {
  it("offers every locale the app ships", () => {
    const shipped = [...new Set(LOCALE_OPTIONS.map((o) => o.key))];
    expect(shipped.sort()).toEqual(["en", "id"]);
    expect(LOCALE_OPTIONS.length).toBe(shipped.length);
  });

  it("matches the CHECK constraint in the migration", () => {
    // The database decides what can be stored and the picker decides what can
    // be chosen; a locale added to one and not the other either cannot be
    // selected or fails on save. Both lists are short, static, and in different
    // languages — exactly the pair that drifts.
    const sql = readFileSync(MIGRATION, "utf8");
    const check = /locale in \(([^)]+)\)/.exec(sql);
    if (!check) throw new Error(`CHECK constraint not found in ${MIGRATION}`);
    const allowed = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(allowed.sort()).toEqual(LOCALE_OPTIONS.map((o) => o.key).sort());
  });
});
