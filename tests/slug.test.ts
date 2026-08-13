import { describe, expect, it } from "vitest";
import { isValidSlug, slugFromTitle } from "@/lib/slug";

describe("slugFromTitle", () => {
  it("makes a URL out of a real book title", () => {
    expect(slugFromTitle("Memahami & Membangun AI — dari Sejarah sampai Agent")).toBe(
      "memahami-membangun-ai-dari-sejarah-sampai-agent",
    );
  });

  it("collapses punctuation runs rather than leaving empty segments", () => {
    expect(slugFromTitle("Hai!!!  Dunia???")).toBe("hai-dunia");
  });

  it("never starts or ends with a hyphen", () => {
    expect(slugFromTitle("  --Judul--  ")).toBe("judul");
  });

  it("returns empty for a title with nothing usable, so callers can fall back", () => {
    expect(slugFromTitle("!!!")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts what slugFromTitle produces", () => {
    expect(isValidSlug(slugFromTitle("Panduan CV Lolos ATS"))).toBe(true);
  });

  it("rejects the shapes that would break a URL or a lookup", () => {
    for (const bad of ["", "-x", "x-", "Halaman", "a b", "a/b", "a--b".replace("--", "__")]) {
      expect(isValidSlug(bad), bad).toBe(false);
    }
  });
});
