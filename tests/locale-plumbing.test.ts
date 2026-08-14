import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_LOCALE, normalizeLocale, translator } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_OPTIONS, pickLocale } from "@/lib/i18n/locales";
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

describe("pickLocale", () => {
  it("uses the storefront's setting when the visitor has not chosen", () => {
    expect(pickLocale(undefined, "en")).toBe("en");
    expect(pickLocale(null, "id")).toBe("id");
    expect(pickLocale("", "en")).toBe("en");
  });

  it("lets the visitor's choice win", () => {
    expect(pickLocale("id", "en")).toBe("id");
    expect(pickLocale("en", "id")).toBe("en");
  });

  it("ignores a cookie naming a locale we do not ship", () => {
    // The failure this prevents is specific: falling back to DEFAULT_LOCALE on
    // junk would drag an English storefront back to Indonesian for anyone
    // carrying a stale or hand-edited cookie.
    for (const junk of ["fr", "EN", "id-ID", "../id", "true"]) {
      expect(pickLocale(junk, "en")).toBe("en");
    }
  });

  it("names the cookie the switcher actually writes", () => {
    // The switcher runs in the browser and cannot import the server resolver,
    // so both read this constant. If it ever splits in two again, the control
    // silently stops working: the cookie is set and nothing reads it.
    expect(LOCALE_COOKIE).toBe("lp_locale");
    const switcher = readFileSync("components/language-switcher.tsx", "utf8");
    expect(switcher).toContain("LOCALE_COOKIE");
    expect(switcher).not.toMatch(/["'`]lp_locale=/);
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

describe("panel language binding", () => {
  /**
   * Every client component that renders text must bind `t` to the request.
   *
   * The failure this catches is silent: `import { t } from "@/lib/i18n"` in a
   * client component compiles, renders, and always produces Indonesian — the
   * switcher appears to do nothing on that screen while working everywhere
   * else. There is no type error and no runtime error to notice.
   */
  function clientComponentsUnderPanel(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".tsx")) out.push(full);
      }
    };
    walk("app/panel");
    out.push("components/panel-sidebar.tsx");
    return out.filter((f) => {
      const src = readFileSync(f, "utf8");
      return src.trimStart().startsWith('"use client"') && /(?<![A-Za-z0-9_$.])t\(/.test(src);
    });
  }

  it("binds t() through the context in every panel client component", () => {
    const unbound = clientComponentsUnderPanel().filter((f) => {
      const src = readFileSync(f, "utf8");
      return src.includes('import { t } from "@/lib/i18n"') || !src.includes("useT()");
    });
    expect(unbound).toEqual([]);
  });

  it("wraps the panel in a LocaleProvider", () => {
    // Without it useT() falls back to the default locale everywhere at once,
    // which looks exactly like "the switcher is broken".
    const layout = readFileSync("app/panel/layout.tsx", "utf8");
    expect(layout).toContain("LocaleProvider");
    expect(layout).toContain("requestLocale()");
  });
});
