import { describe, expect, it } from "vitest";
import { DEFAULT_LEGAL, LEGAL_KEYS, normalizeLegal } from "@/lib/legal-config";
import { DEFAULT_HIRING, normalizeHiring } from "@/lib/hiring-config";

/**
 * Both of these read whatever JSON happens to be in lp_site_settings, including
 * rows written by an older shape of the code. The normalizers are the only thing
 * standing between that and a blank legal page or a mis-graded applicant.
 */
describe("normalizeLegal", () => {
  it("falls back to the shipped copy for anything missing", () => {
    expect(normalizeLegal(null)).toEqual(DEFAULT_LEGAL);
    expect(normalizeLegal({}).privacy.body).toBe(DEFAULT_LEGAL.privacy.body);
  });

  it("keeps stored copy", () => {
    const out = normalizeLegal({ terms: { title: "Syarat", body: "<p>Hi</p>" } });
    expect(out.terms.title).toBe("Syarat");
    expect(out.terms.body).toBe("<p>Hi</p>");
  });

  it("treats a blank title or body as absent rather than storing an empty page", () => {
    const out = normalizeLegal({ refund: { title: "   ", description: "", body: "  " } });
    expect(out.refund.title).toBe(DEFAULT_LEGAL.refund.title);
    expect(out.refund.body).toBe(DEFAULT_LEGAL.refund.body);
    // An empty description IS a valid choice — it means "derive one from the body".
    expect(out.refund.description).toBe("");
  });

  it("has no updatedAt until something has actually been saved", () => {
    expect(normalizeLegal({}).updatedAt).toBeNull();
    expect(normalizeLegal({ updatedAt: "  " }).updatedAt).toBeNull();
    expect(normalizeLegal({ updatedAt: "2026-08-17T00:00:00.000Z" }).updatedAt).toBe(
      "2026-08-17T00:00:00.000Z",
    );
  });

  it("ships every page the routes render", () => {
    for (const key of LEGAL_KEYS) {
      expect(DEFAULT_LEGAL[key].title.trim(), key).not.toBe("");
      expect(DEFAULT_LEGAL[key].body.length, key).toBeGreaterThan(100);
    }
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

  it("keeps the enabled flag, including when it is off", () => {
    expect(normalizeHiring({ enabled: false }).enabled).toBe(false);
    expect(normalizeHiring({}).enabled).toBe(true);
  });

  it("ships a {count} placeholder in both counted sentences", () => {
    // The pages substitute it; a default without it would silently drop the
    // number of questions from the pitch.
    expect(DEFAULT_HIRING.ctaBody).toContain("{count}");
    expect(DEFAULT_HIRING.testIntro).toContain("{count}");
  });
});
