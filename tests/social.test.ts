import { describe, expect, it } from "vitest";
import { DEFAULT_SOCIAL_URLS, normalizeSocialUrls, SOCIAL_KEYS } from "@/lib/social";

/**
 * The distinction that matters here is "never set" versus "deliberately
 * cleared". Getting it backwards either resurrects an icon the owner removed or
 * wipes the four the site shipped with.
 */
describe("normalizeSocialUrls", () => {
  it("falls back to the shipped address when a key was never set", () => {
    expect(normalizeSocialUrls({})).toEqual(DEFAULT_SOCIAL_URLS);
    expect(normalizeSocialUrls(null)).toEqual(DEFAULT_SOCIAL_URLS);
  });

  it("treats an empty string as a deliberate removal", () => {
    expect(normalizeSocialUrls({ tiktok: "" }).tiktok).toBe("");
    // …and leaves the others alone.
    expect(normalizeSocialUrls({ tiktok: "" }).instagram).toBe(DEFAULT_SOCIAL_URLS.instagram);
  });

  it("keeps a changed http(s) address", () => {
    expect(normalizeSocialUrls({ instagram: "https://instagram.com/lain" }).instagram).toBe(
      "https://instagram.com/lain",
    );
  });

  it("treats a non-http value as removed rather than rendering it", () => {
    expect(normalizeSocialUrls({ youtube: "javascript:alert(1)" }).youtube).toBe("");
    expect(normalizeSocialUrls({ youtube: "ftp://x.test" }).youtube).toBe("");
  });

  it("always returns every network", () => {
    const out = normalizeSocialUrls({ instagram: "https://a.test" });
    expect(Object.keys(out).sort()).toEqual([...SOCIAL_KEYS].sort());
  });
});
