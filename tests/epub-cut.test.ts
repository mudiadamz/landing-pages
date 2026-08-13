import { describe, expect, it } from "vitest";
import { keepCountForCut } from "@/lib/epub-cut";

/**
 * `preview_cut_percent` is the share WITHHELD, not the share shown. Reading it
 * the other way round gives the whole book away, and the number is the same
 * shape either way — nothing about a 70 looks wrong.
 */
describe("keepCountForCut", () => {
  const tenEqualChapters = Array(10).fill(1000);

  it("stores 70 to show 30% of the book", () => {
    expect(keepCountForCut(tenEqualChapters, 70)).toBe(3);
  });

  it("stores 30 to show 70% of the book", () => {
    expect(keepCountForCut(tenEqualChapters, 30)).toBe(7);
  });

  it("never shows the whole book, however small the cut", () => {
    expect(keepCountForCut(tenEqualChapters, 0)).toBeLessThan(tenEqualChapters.length);
  });

  it("always leaves at least one chapter to read", () => {
    expect(keepCountForCut(tenEqualChapters, 100)).toBeGreaterThanOrEqual(1);
  });

  it("handles a book whose chapters are empty", () => {
    expect(keepCountForCut([0, 0, 0], 50)).toBeGreaterThanOrEqual(1);
  });

  it("handles no chapters at all", () => {
    expect(keepCountForCut([], 50)).toBe(0);
  });

  it("weights by length, not chapter count", () => {
    // One huge opening chapter is already most of the book.
    expect(keepCountForCut([9000, 100, 100, 100], 50)).toBe(1);
  });
});
