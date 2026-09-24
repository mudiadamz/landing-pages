import { describe, expect, it } from "vitest";
import {
  archiveOfPath,
  archivePath,
  bloggerSlug,
  buildPagePath,
  buildPostPath,
  isMonthSegment,
  isYearSegment,
  labelPath,
  monthSegment,
  postPathFromSegments,
  searchPath,
  stripHtmlSuffix,
} from "@/lib/blog-path";

/**
 * These strings are the feature. A blog moved off Blogger keeps its readers
 * only if every address it ever published still answers, so an "almost right"
 * URL here is indistinguishable from deleting the post.
 */

describe("segment shapes", () => {
  it("accepts a four-digit year in Blogger's range", () => {
    expect(isYearSegment("2026")).toBe(true);
    expect(isYearSegment("1999")).toBe(true);
  });

  it("rejects anything that is not a year, so the archive route cannot swallow other paths", () => {
    for (const v of ["26", "20260", "abcd", "1998", "", "2o26"]) {
      expect(isYearSegment(v), v).toBe(false);
    }
  });

  it("requires a two-digit month — /2026/9/ is not an address Blogger ever made", () => {
    expect(isMonthSegment("09")).toBe(true);
    expect(isMonthSegment("12")).toBe(true);
    for (const v of ["9", "00", "13", "1", ""]) {
      expect(isMonthSegment(v), v).toBe(false);
    }
  });

  it("pads the month from a date, in UTC", () => {
    expect(monthSegment(new Date("2026-09-22T05:20:49Z"))).toBe("09");
    expect(monthSegment(new Date("2026-12-01T00:00:00Z"))).toBe("12");
    // 23:30 on the 31st in Jakarta is still December in UTC; the archive a post
    // lands in must not depend on where the server happens to be.
    expect(monthSegment(new Date("2026-12-31T23:30:00Z"))).toBe("12");
  });
});

describe("building paths", () => {
  it("builds a post path Blogger would recognise", () => {
    expect(buildPostPath(new Date("2026-09-22T05:20:49Z"), "hello-world")).toBe(
      "/2026/09/hello-world.html",
    );
  });

  it("builds a page path under /p/", () => {
    expect(buildPagePath("about-us")).toBe("/p/about-us.html");
  });

  it("percent-encodes a label the way Blogger does — spaces are %20, not + or -", () => {
    expect(labelPath("Cloud Computing")).toBe("/search/label/Cloud%20Computing");
    expect(labelPath("C#")).toBe("/search/label/C%23");
  });

  it("builds year and month archives with a trailing slash", () => {
    expect(archivePath(2026)).toBe("/2026/");
    expect(archivePath(2026, 9)).toBe("/2026/09/");
    expect(archivePath("2026", "09")).toBe("/2026/09/");
  });

  it("builds a search path", () => {
    expect(searchPath("docker compose")).toBe("/search?q=docker%20compose");
  });
});

describe(".html is part of the address, not a file extension", () => {
  it("strips it when present", () => {
    expect(stripHtmlSuffix("about-us.html")).toBe("about-us");
  });

  /**
   * The separator between this app's own `/p/[slug]` editorial pages and an
   * imported Blogger page at `/p/slug.html`. Returning a slug for a path with
   * no suffix would let one shadow the other.
   */
  it("returns null without it, which is how /p/about stays the editorial page", () => {
    expect(stripHtmlSuffix("about-us")).toBeNull();
    expect(stripHtmlSuffix("about.htm")).toBeNull();
    expect(stripHtmlSuffix("")).toBeNull();
  });
});

describe("parsing route segments back into a path", () => {
  it("round-trips a real post address", () => {
    expect(postPathFromSegments("2026", "09", "amazon-lightsail-aws-without-aws.html")).toBe(
      "/2026/09/amazon-lightsail-aws-without-aws.html",
    );
  });

  it("refuses segments that are not a Blogger post address", () => {
    expect(postPathFromSegments("2026", "9", "x.html")).toBeNull();
    expect(postPathFromSegments("panel", "09", "x.html")).toBeNull();
    expect(postPathFromSegments("2026", "09", "x")).toBeNull();
  });

  it("reads the archive back out of a stored path", () => {
    expect(archiveOfPath("/2026/09/foo.html")).toEqual({ year: "2026", month: "09" });
    expect(archiveOfPath("/p/about.html")).toBeNull();
  });
});

describe("bloggerSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(bloggerSlug("Hello, World!")).toBe("hello-world");
  });

  it("cuts at 40 characters on a word boundary, never mid-word", () => {
    const slug = bloggerSlug("How do you make your Windows laptop run faster today");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).toBe("how-do-you-make-your-windows-laptop-run");
  });

  it("never ends in a hyphen — the tell of a plain slice", () => {
    for (const title of ["a".repeat(39) + " bb", "Word ".repeat(20), "Satu Dua Tiga Empat Lima Enam Tujuh"]) {
      expect(bloggerSlug(title).endsWith("-"), title).toBe(false);
    }
  });

  it("hard-cuts a single word with no boundary to cut on", () => {
    expect(bloggerSlug("x".repeat(60))).toBe("x".repeat(40));
  });
});
