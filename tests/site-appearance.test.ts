import { describe, it, expect } from "vitest";
import {
  BOOT_BG_DARK,
  BOOT_BG_LIGHT,
  readableInk,
  siteAppearance,
} from "@/lib/site-appearance";
import { IOS_SPLASH_TARGETS, parseSplashSpec, splashUrl } from "@/lib/ios-splash";
import { parseIconSpec } from "@/lib/pwa-icons";

/**
 * These are the boot surfaces — the manifest colour, the toolbar tint, the iOS
 * launch image. Everything they get wrong is invisible on the machine you build
 * on: a white flash before a cream page, or one domain's mark on another
 * domain's install, both only on a cold start on a phone. That is exactly the
 * kind of silent failure docs/architecture.md §6 says to pin down with a test.
 */

const WARM = { surfaces: { background: "#f5edda", card: "#fffaf0" } };

describe("siteAppearance", () => {
  it("falls back to the app background when a template declares no surfaces", () => {
    const look = siteAppearance({ name: "Toko", icon_url: null });
    expect(look.background).toBe(BOOT_BG_LIGHT);
    expect(look.backgroundDark).toBe(BOOT_BG_DARK);
  });

  it("uses the template's own page colour, so the install doesn't flash white", () => {
    expect(siteAppearance({ name: "Mbah" }, WARM).background).toBe("#f5edda");
  });

  it("keeps a light-only template light in dark mode", () => {
    // html.dark never applies there, so a dark launch image would cover a light app.
    const look = siteAppearance({ name: "Bio" }, { ...WARM, lightOnly: true });
    expect(look.backgroundDark).toBe("#f5edda");
  });

  it("marks the ADM.UIUX default as not the storefront's own", () => {
    expect(siteAppearance({ name: "Toko" }).hasOwnIcon).toBe(false);
    expect(siteAppearance({ name: "Toko", icon_url: " " }).hasOwnIcon).toBe(false);
    expect(siteAppearance({ name: "Toko", icon_url: "https://x/i.png" }).hasOwnIcon).toBe(true);
  });

  it("changes its version whenever a cached image would have to be redrawn", () => {
    const base = siteAppearance({ name: "Toko", icon_url: "https://x/i-1.png" });
    const newIcon = siteAppearance({ name: "Toko", icon_url: "https://x/i-2.png" });
    const newName = siteAppearance({ name: "Toko Baru", icon_url: "https://x/i-1.png" });
    const newBg = siteAppearance({ name: "Toko", icon_url: "https://x/i-1.png" }, WARM);
    expect(new Set([base.version, newIcon.version, newName.version, newBg.version]).size).toBe(4);
    // …and is stable for identical input, or the CDN would never get a hit.
    expect(siteAppearance({ name: "Toko", icon_url: "https://x/i-1.png" }).version).toBe(base.version);
  });
});

describe("readableInk", () => {
  it("picks ink that survives both a cream and a charcoal ground", () => {
    expect(readableInk("#f5edda")).toBe("#1c1b1a");
    expect(readableInk(BOOT_BG_LIGHT)).toBe("#1c1b1a");
    expect(readableInk(BOOT_BG_DARK)).toBe("#f4f4f5");
  });

  it("does not go white on an unparseable colour", () => {
    expect(readableInk("rebeccapurple")).toBe("#1c1b1a");
  });
});

describe("parseSplashSpec", () => {
  it("accepts every size the layout actually links to", () => {
    for (const t of IOS_SPLASH_TARGETS) {
      const url = splashUrl(t, "dark", "abc");
      const spec = url.slice("/api/splash/".length, url.indexOf("?"));
      expect(parseSplashSpec(spec)).toEqual({
        width: t.w * t.r,
        height: t.h * t.r,
        scheme: "dark",
      });
    }
  });

  it("refuses sizes we never declared — the route must not be an image generator", () => {
    expect(parseSplashSpec("20000x20000-light.png")).toBeNull();
    expect(parseSplashSpec("1000x1000-light.png")).toBeNull();
    expect(parseSplashSpec("1170x2532-sepia.png")).toBeNull();
    expect(parseSplashSpec("1170x2532-light.jpg")).toBeNull();
    expect(parseSplashSpec("../../etc/passwd")).toBeNull();
    expect(parseSplashSpec("")).toBeNull();
  });
});

describe("parseIconSpec", () => {
  it("draws only the five icons the manifest and the layout ask for", () => {
    expect(parseIconSpec("apple-180.png")?.size).toBe(180);
    expect(parseIconSpec("maskable-512.png")?.purpose).toBe("maskable");
    expect(parseIconSpec("icon-192.png")?.purpose).toBe("any");
    expect(parseIconSpec("icon-4096.png")).toBeNull();
    expect(parseIconSpec("toString")).toBeNull();
  });

  it("keeps the maskable mark inside the launcher's crop", () => {
    // A maskable icon may be cut to a circle of 80% diameter; anything bigger
    // than that loses part of the logo on Android.
    expect(parseIconSpec("maskable-512.png")!.markRatio).toBeLessThanOrEqual(0.8);
  });
});
