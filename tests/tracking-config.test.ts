import { describe, it, expect } from "vitest";
import {
  normalizeTawkPropertyId,
  normalizeTawkWidgetId,
  normalizeTracking,
  parseTawkEmbed,
  tawkEnabled,
} from "@/lib/tracking-config";

/**
 * The Tawk ids used to be hardcoded, so nothing could be typed wrong. Now an
 * admin pastes them, and a wrong pair fails the way third-party embeds always
 * do: the script 404s in the background and the chat simply never appears —
 * no error, nothing in the panel to look at. These are the checks that turn
 * that into a message at save time.
 */

const REAL = "69b470e17afc871c37be198a";

describe("parseTawkEmbed", () => {
  it("takes the whole snippet an admin actually has to hand", () => {
    const snippet = `var Tawk_API=Tawk_API||{};
      s1.src='https://embed.tawk.to/${REAL}/1jjkdht1t';`;
    expect(parseTawkEmbed(snippet)).toEqual({ propertyId: REAL, widgetId: "1jjkdht1t" });
  });

  it("takes the bare URL too", () => {
    expect(parseTawkEmbed(`https://embed.tawk.to/${REAL}/default`)).toEqual({
      propertyId: REAL,
      widgetId: "default",
    });
  });

  it("does not invent a pair out of something that is not a tawk URL", () => {
    expect(parseTawkEmbed("https://embed.example.com/abc/def")).toBeNull();
    expect(parseTawkEmbed(REAL)).toBeNull(); // an id alone is not an embed
    expect(parseTawkEmbed("")).toBeNull();
    expect(parseTawkEmbed(null)).toBeNull();
  });
});

describe("normalizeTawkPropertyId", () => {
  it("accepts 24 hex characters, in either case", () => {
    expect(normalizeTawkPropertyId(REAL)).toBe(REAL);
    expect(normalizeTawkPropertyId(`  ${REAL.toUpperCase()}  `)).toBe(REAL);
  });

  it("rejects anything that would build a 404 embed URL", () => {
    expect(normalizeTawkPropertyId(REAL.slice(0, 23))).toBe("");
    expect(normalizeTawkPropertyId(`${REAL}0`)).toBe("");
    expect(normalizeTawkPropertyId("69b470e17afc871c37be198z")).toBe(""); // z is not hex
    expect(normalizeTawkPropertyId("../../etc/passwd")).toBe("");
    expect(normalizeTawkPropertyId(42)).toBe("");
  });
});

describe("normalizeTawkWidgetId", () => {
  it("keeps the alphanumeric ids Tawk hands out", () => {
    expect(normalizeTawkWidgetId("1jjkdht1t")).toBe("1jjkdht1t");
    expect(normalizeTawkWidgetId("default")).toBe("default");
  });

  it("refuses anything that could escape the URL path", () => {
    expect(normalizeTawkWidgetId("abc/def")).toBe("");
    expect(normalizeTawkWidgetId("a b")).toBe("");
    expect(normalizeTawkWidgetId("ab")).toBe(""); // too short to be real
  });
});

describe("normalizeTracking", () => {
  it("stores the chat ids as a pair, or not at all", () => {
    // Half a pair builds an embed URL that belongs to nobody. Better off.
    expect(normalizeTracking({ tawkPropertyId: REAL })).toMatchObject({
      tawkPropertyId: "",
      tawkWidgetId: "",
    });
    expect(normalizeTracking({ tawkWidgetId: "1jjkdht1t" })).toMatchObject({
      tawkPropertyId: "",
      tawkWidgetId: "",
    });
    expect(
      normalizeTracking({ tawkPropertyId: REAL, tawkWidgetId: "1jjkdht1t" }),
    ).toMatchObject({ tawkPropertyId: REAL, tawkWidgetId: "1jjkdht1t" });
  });

  it("leaves a storefront with no chat when nothing is configured", () => {
    const cfg = normalizeTracking({});
    expect(tawkEnabled(cfg)).toBe(false);
    // …and no longer falls back to somebody else's property id.
    expect(cfg.tawkPropertyId).toBe("");
  });

  it("still normalises the GTM container alongside it", () => {
    expect(normalizeTracking({ gtmId: "gtm-tl7m8vmj" }).gtmId).toBe("GTM-TL7M8VMJ");
  });
});
