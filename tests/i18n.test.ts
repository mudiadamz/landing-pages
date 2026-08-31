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
    "common.price",
    "common.required",
    "common.search",
    "home.themeToggle",
    "nav.categories",
    "panel.socialHint",
    "sites.domain",
  ];

  it("has no unused keys beyond the declared backlog", () => {
    // The other direction of the missing-key test. A key with no caller is
    // usually the residue of a half-finished move: the string was added to the
    // dictionary and the component kept its hardcoded copy, so the translation
    // exists and nothing renders it.
    const used = new Set<string>();
    for (const file of files) {
      // Every dictionary lists every key as a literal. The `t("…")` scan below
      // is immune to that, but the literal scan is not: including en.ts marked
      // all 409 keys used and the assertion passed while proving nothing.
      if (file.includes(join("lib", "i18n"))) continue;
      const src = readFileSync(file, "utf8");
      for (const [, key] of src.matchAll(CALL)) used.add(key);
      // Keys also travel as data — the product editor's tab list holds
      // `labelKey: "product.tabDetail"` and translates at render, because a
      // label resolved in a module-scope array would freeze the language that
      // happened to load first. Those are uses; counting only `t("…")` calls
      // reported six of them as dead.
      // Digits count: `titleKey: "panel.step1Desc"` is a use, and the old
      // [A-Za-z]+ tail reported three of those as dead keys.
      for (const [, key] of src.matchAll(/(?<!t\()"([a-z]+\.[A-Za-z0-9]+)"/g)) {
        if (key in id) used.add(key);
      }
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
  /**
   * Same words, different jobs — each pair is allowed to diverge in another
   * language, so they stay separate keys rather than being merged.
   *
   * The recurring shape is a NAV LABEL beside a FIELD LABEL: "Kategori" names a
   * sidebar destination, a public nav link and a form field, and a translator
   * shortening the sidebar has no business shortening the form.
   */
  const INTENTIONAL_DUPLICATES: Record<string, string[]> = {
    Harga: ["common.price", "product.tabPrice"],
    Kategori: ["common.category", "nav.categories", "panel.navCategories"],
    "Cari produk…": ["home.searchPlaceholder", "product.relatedSearch"],
    "Cari produk": ["home.searchLabel", "home.searchOpen"],
    "Link lainnya": ["home.otherLinks", "panel.tabOther"],
    Preview: ["checkout.preview", "product.tabPreview", "analytics.previews"],
    // An event's venue field vs the geo column of a session.
    Lokasi: ["analytics.location", "product.eventLocation"],
    "Nama situs": ["panel.linkName", "sites.siteName"],
    Ketentuan: ["content.tabLegal", "nav.terms"],
    "Judul halaman": ["content.pageTitle", "panel.pageTitlePlaceholder"],
    "Ke beranda": ["common.toHome", "notFound.home"],
    // Panel sidebar destinations vs the screens they lead to.
    Hiring: ["nav.hiring", "panel.navHiring"],
    Kontak: ["nav.contact", "panel.navContacts"],
    "Pembelian saya": ["nav.myPurchases", "panel.navPurchases"],
    Assets: ["assets.heading", "panel.navAssets"],
    Domain: ["panel.navDomains", "sites.domain"],
    "Identitas situs": ["panel.navBranding", "sites.identity"],
    Halaman: ["content.tabPages", "panel.navPages"],
    // The sales section heading (plural in English) vs the invoice's label for
    // the one person being billed.
    Pelanggan: ["sales.customer", "sales.customers"],
    // A session-table column (one device) vs a chart section (all devices);
    // English already splits them into "Device" and "Devices".
    Perangkat: ["analytics.device", "stats.devices"],
    // The inbox's column heading ("List") vs the sign-up call to action.
    Daftar: ["auth.signUp", "panel.list"],
    // The popup's body field vs the chapter editor's rich/source view switch.
    Teks: ["editor.richText", "panel.text"],
    // Storage's "open this file" vs the setup guide's "open this section".
    Buka: ["panel.open", "sites.open"],
    // A domain copied to the clipboard vs a chat answer copied to it. Same verb,
    // and two surfaces that have no reason to be edited together.
    Tersalin: ["sites.copied", "chat.copied"],
    // A product's title vs a chat's — English already wants different articles.
    "Judul tidak boleh kosong.": ["product.errTitleEmpty", "chat.titleRequired"],
    // Where traffic came from, vs the pages a web search cited. English already
    // splits them: "Source" for the analytics column, "Sources" for the list.
    Sumber: ["analytics.source", "chat.sources"],
    // Re-check a domain's DNS vs re-send a chat message that failed.
    "Coba lagi": ["sites.tryAgain", "chat.retry"],
    // The 404 page's way out vs the enquiry route for a plan with no price on it.
    // English is already free to split them ("Contact us" / "Get in touch").
    "Hubungi kami": ["notFound.contact", "plan.contactUs"],
    // The panel account menu's row label vs the chat's own appearance setting.
    // Two different preference screens; neither should move when the other is
    // reworded.
    Tema: ["panel.themeLabel", "chat.theme"],
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
