import { describe, expect, it } from "vitest";
import {
  canSwitchPanelView,
  deniedMenu,
  deniedPath,
  normalizePanelView,
  resolvePanelView,
} from "@/lib/panel-view";

describe("normalizePanelView", () => {
  it("accepts the two views", () => {
    expect(normalizePanelView("business")).toBe("business");
    expect(normalizePanelView("CUSTOMER")).toBe("customer");
  });

  it("refuses anything else rather than guessing", () => {
    for (const v of ["admin", "", null, undefined, 7]) {
      expect(normalizePanelView(v), String(v)).toBeNull();
    }
  });
});

describe("resolvePanelView", () => {
  it("defaults a business person to the business shell", () => {
    expect(resolvePanelView(null, false)).toBe("business");
    expect(resolvePanelView("nonsense", false)).toBe("business");
  });

  it("honours the choice of someone who has one", () => {
    expect(resolvePanelView("customer", false)).toBe("customer");
    expect(resolvePanelView("business", false)).toBe("business");
  });

  /**
   * The asymmetry is the point. A customer-only person has no business shell to
   * be shown, so a stale or hand-edited cookie must not hand them a rail of
   * twenty-six menus that every one of which would refuse them.
   */
  it("never gives the business shell to someone with no business capabilities", () => {
    expect(resolvePanelView("business", true)).toBe("customer");
    expect(resolvePanelView("customer", true)).toBe("customer");
  });

  it("offers the switch only to people who have somewhere to switch from", () => {
    expect(canSwitchPanelView(false)).toBe(true);
    expect(canSwitchPanelView(true)).toBe(false);
  });
});

describe("denied access", () => {
  it("names the menu in the URL, so the dashboard can say which one", () => {
    expect(deniedPath("sites")).toBe("/panel?denied=sites");
    expect(deniedMenu("sites")).toBe("sites");
  });

  /**
   * The parameter is reflected onto the page, so it is matched against a known
   * list rather than trusted. An unknown value degrades to a plain redirect —
   * the old behaviour — instead of becoming a sentence somebody wrote for us.
   */
  it("refuses a menu name it does not know", () => {
    expect(deniedPath("<script>")).toBe("/panel");
    expect(deniedMenu("<script>")).toBeNull();
    expect(deniedMenu(undefined)).toBeNull();
    expect(deniedMenu("")).toBeNull();
  });

  it("reads the first value when a parameter arrives twice", () => {
    expect(deniedMenu(["roles", "sites"])).toBe("roles");
  });
});
