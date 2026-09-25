import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEGAL,
  LEGAL_KEYS,
  normalizeLegal,
  resolveLegal,
  writtenLocales,
} from "@/lib/legal-config";
import { DEFAULT_HIRING, normalizeHiring } from "@/lib/hiring-config";

/**
 * Both of these read whatever JSON happens to be in lp_site_settings, including
 * rows written by an older shape of the code. The normalizers are the only thing
 * standing between that and a blank legal page or a mis-graded applicant.
 */
describe("normalizeLegal", () => {
  const doc = (raw: unknown, loc: "id" | "en" = "id") => normalizeLegal(raw, loc).locales[loc]!;

  it("falls back to the shipped copy for anything missing", () => {
    expect(doc(null)).toEqual({ ...DEFAULT_LEGAL, updatedAt: null });
    expect(doc({}).privacy.body).toBe(DEFAULT_LEGAL.privacy.body);
  });

  it("keeps stored copy", () => {
    const out = doc({ terms: { title: "Syarat", body: "<p>Hi</p>" } });
    expect(out.terms.title).toBe("Syarat");
    expect(out.terms.body).toBe("<p>Hi</p>");
  });

  it("treats a blank title or body as absent rather than storing an empty page", () => {
    const out = doc({ refund: { title: "   ", description: "", body: "  " } });
    expect(out.refund.title).toBe(DEFAULT_LEGAL.refund.title);
    expect(out.refund.body).toBe(DEFAULT_LEGAL.refund.body);
    // An empty description IS a valid choice — it means "derive one from the body".
    expect(out.refund.description).toBe("");
  });

  it("has no updatedAt until something has actually been saved", () => {
    expect(doc({}).updatedAt).toBeNull();
    expect(doc({ updatedAt: "  " }).updatedAt).toBeNull();
    expect(doc({ updatedAt: "2026-08-17T00:00:00.000Z" }).updatedAt).toBe(
      "2026-08-17T00:00:00.000Z",
    );
  });

  it("ships every page the routes render", () => {
    for (const key of LEGAL_KEYS) {
      expect(DEFAULT_LEGAL[key].title.trim(), key).not.toBe("");
      expect(DEFAULT_LEGAL[key].body.length, key).toBeGreaterThan(100);
    }
  });

  /**
   * The flat `{privacy, terms, refund}` shape is what every storefront has
   * stored today. It is converted on READ rather than by a database migration,
   * because it is JSON inside a settings row — so a site that never saves again
   * has to keep working forever.
   */
  it("reads the old flat shape as the site's own language", () => {
    const out = normalizeLegal({ terms: { title: "Syarat lama" } }, "id");
    expect(out.locales.id?.terms.title).toBe("Syarat lama");
    expect(out.locales.en).toBeUndefined();
  });

  it("puts legacy copy in whichever language the site is actually in", () => {
    const out = normalizeLegal({ terms: { title: "Old terms" } }, "en");
    expect(out.locales.en?.terms.title).toBe("Old terms");
    expect(out.locales.id).toBeUndefined();
  });

  it("reads the multilingual shape, keeping the languages apart", () => {
    const out = normalizeLegal(
      { locales: { id: { terms: { title: "Ketentuan" } }, en: { terms: { title: "Terms" } } } },
      "id",
    );
    expect(out.locales.id?.terms.title).toBe("Ketentuan");
    expect(out.locales.en?.terms.title).toBe("Terms");
  });

  it("does not invent a language nobody wrote", () => {
    const out = normalizeLegal({ locales: { id: { terms: { title: "Ketentuan" } } } }, "id");
    expect(writtenLocales(out)).toEqual(["id"]);
  });

  /**
   * A `locales` object holding nothing recognisable is a broken read, not a
   * storefront that deleted its policies — answering with the shipped defaults
   * beats answering with nothing.
   */
  it("survives a locales object with nothing usable in it", () => {
    expect(writtenLocales(normalizeLegal({ locales: { fr: {} } }, "id"))).toEqual(["id"]);
  });
});

describe("resolveLegal", () => {
  const content = normalizeLegal(
    { locales: { id: { terms: { title: "Ketentuan" } }, en: { terms: { title: "Terms" } } } },
    "id",
  );

  it("gives the language asked for", () => {
    expect(resolveLegal(content, "en", "id")).toMatchObject({ usedLocale: "en", isFallback: false });
    expect(resolveLegal(content, "id", "id").doc.terms.title).toBe("Ketentuan");
  });

  /**
   * An English reader on a storefront whose policy exists only in Indonesian is
   * better served by the Indonesian text than by an empty page — but the caller
   * is told it happened, because a reader agreeing to terms deserves to know
   * they are reading a fallback.
   */
  it("falls back to the site's own language, and says that it did", () => {
    const onlyId = normalizeLegal({ locales: { id: { terms: { title: "Ketentuan" } } } }, "id");
    const out = resolveLegal(onlyId, "en", "id");
    expect(out.usedLocale).toBe("id");
    expect(out.isFallback).toBe(true);
    expect(out.doc.terms.title).toBe("Ketentuan");
  });

  it("falls back to any written language when even the site's own is missing", () => {
    const onlyEn = normalizeLegal({ locales: { en: { terms: { title: "Terms" } } } }, "en");
    expect(resolveLegal(onlyEn, "id", "id")).toMatchObject({ usedLocale: "en", isFallback: true });
  });

  it("answers with the shipped copy rather than nothing when there is none at all", () => {
    const out = resolveLegal({ locales: {} }, "id", "id");
    expect(out.doc.privacy.body).toBe(DEFAULT_LEGAL.privacy.body);
    expect(out.isFallback).toBe(false);
  });
});

describe("normalizeHiring", () => {
  it("falls back to the shipped ad", () => {
    expect(normalizeHiring(undefined)).toEqual(DEFAULT_HIRING);
    expect(normalizeHiring({}).questions).toEqual(DEFAULT_HIRING.questions);
  });

  it("keeps an empty question list rather than restoring the shipped ten", () => {
    // Deleting every question is a decision, not an accident to undo.
    expect(normalizeHiring({ questions: [] }).questions).toEqual([]);
  });

  it("drops questions nobody could answer", () => {
    const out = normalizeHiring({
      questions: [
        { id: 1, question: "", options: ["a", "b"], answer: 0 },
        { id: 2, question: "Only one option?", options: ["a"], answer: 0 },
        { id: 3, question: "Fine", options: ["a", "b"], answer: 1 },
      ],
    });
    expect(out.questions.map((q) => q.id)).toEqual([3]);
  });

  it("clamps the correct-answer index into range", () => {
    // Out of range would mark every applicant wrong on that question forever.
    const out = normalizeHiring({
      questions: [
        { id: 1, question: "Q", options: ["a", "b", "c"], answer: 9 },
        { id: 2, question: "Q", options: ["a", "b"], answer: -3 },
      ],
    });
    expect(out.questions[0].answer).toBe(2);
    expect(out.questions[1].answer).toBe(0);
  });

  it("keeps the enabled flag, and defaults off (hiring demo disabled)", () => {
    expect(normalizeHiring({ enabled: true }).enabled).toBe(true);
    expect(normalizeHiring({ enabled: false }).enabled).toBe(false);
    // Default is off — a fresh site ships no vacancy (audit Tahap 1).
    expect(normalizeHiring({}).enabled).toBe(false);
  });

  it("ships a {count} placeholder in both counted sentences", () => {
    // The pages substitute it; a default without it would silently drop the
    // number of questions from the pitch.
    expect(DEFAULT_HIRING.ctaBody).toContain("{count}");
    expect(DEFAULT_HIRING.testIntro).toContain("{count}");
  });
});
