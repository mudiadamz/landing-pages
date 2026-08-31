import { describe, it, expect } from "vitest";
import { isTawkHidden } from "@/lib/tawk-visibility";

/**
 * The rule this encodes failed silently for months in two different ways, and
 * both looked fine on a reload:
 *
 *   - the launcher stayed on /panel after a client-side navigation, because the
 *     component rendering `null` never removed a widget the script had already
 *     put on <body>;
 *   - the preview check still named `/lp`, the route it was moved away from, so
 *     the bubble sat on every product preview.
 *
 * A test cannot see a floating iframe. It can pin which paths are supposed to be
 * off-limits, which is the half that actually decides.
 */
describe("isTawkHidden", () => {
  it("hides on the admin panel, at every depth", () => {
    expect(isTawkHidden("/panel", false)).toBe(true);
    expect(isTawkHidden("/panel/users", false)).toBe(true);
    expect(isTawkHidden("/panel/product/abc/edit", false)).toBe(true);
  });

  it("hides on the product preview — the route it moved to, not the old one", () => {
    expect(isTawkHidden("/preview/ebook-anu", false)).toBe(true);
  });

  it("hides on a fullscreen homepage, and only on that one route", () => {
    expect(isTawkHidden("/", true)).toBe(true);
    expect(isTawkHidden("/", false)).toBe(false);
    // The chat template only owns its homepage; its other pages are ordinary.
    expect(isTawkHidden("/checkout/anu", true)).toBe(false);
  });

  it("stays visible everywhere a visitor might want support", () => {
    for (const p of ["/", "/checkout/anu", "/categories", "/read/anu", "/contact", "/login"]) {
      expect(isTawkHidden(p, false)).toBe(false);
    }
  });

  it("does not treat a path that merely starts with the same letters as the panel", () => {
    // /panels-of-glass is a product slug, not the admin area.
    expect(isTawkHidden("/panels-of-glass", false)).toBe(false);
    expect(isTawkHidden("/previews-terbaik", false)).toBe(false);
  });

  it("shows nothing away for a null pathname", () => {
    expect(isTawkHidden(null, true)).toBe(false);
  });
});
