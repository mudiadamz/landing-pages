import { describe, expect, it } from "vitest";
import {
  groupsCookie,
  isGroupOpen,
  parseGroupOverrides,
  parsePins,
  pinsCookie,
} from "@/lib/panel-chrome";

const value = (cookie: string) => cookie.split(";")[0].split("=")[1];

describe("pinned menus", () => {
  it("round-trips through the cookie in pin order", () => {
    const pins = ["/panel/sales", "/panel", "/panel/product-stats"];
    expect(parsePins(value(pinsCookie(pins)))).toEqual(pins);
  });

  it("keeps only panel paths, once each", () => {
    expect(parsePins("/panel/sales,/panel/sales,https://evil.example,/panel/../x,/elsewhere")).toEqual([
      "/panel/sales",
    ]);
  });

  it("treats a missing or mangled cookie as no pins", () => {
    expect(parsePins(undefined)).toEqual([]);
    expect(parsePins("%E0%A4%A")).toEqual([]);
  });
});

describe("menu groups", () => {
  /** "All hidden" is the default — except the group holding the page you are on. */
  it("folds every group by default, but not the one with the open page", () => {
    expect(isGroupOpen("panel.navGroupUsers", {}, false)).toBe(false);
    expect(isGroupOpen("panel.navGroupUsers", {}, true)).toBe(true);
  });

  it("honours an explicit choice either way", () => {
    expect(isGroupOpen("g", { g: true }, false)).toBe(true);
    expect(isGroupOpen("g", { g: false }, true)).toBe(false);
  });

  it("round-trips the choices through the cookie", () => {
    const o = { "panel.navGroupMain": true, "panel.navGroupSystem": false };
    expect(parseGroupOverrides(value(groupsCookie(o)))).toEqual(o);
    expect(parseGroupOverrides("junk,x:2")).toEqual({});
  });
});
