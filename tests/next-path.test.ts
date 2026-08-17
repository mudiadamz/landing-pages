import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/next-path";

/**
 * The guard on where a sign-in may send someone.
 *
 * Worth a test of its own because the failure is invisible: an open redirect on
 * the login page looks and behaves exactly like a working login page, right up
 * until the link in somebody's inbox carries a `next` that leaves the site.
 */
describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/panel/purchases")).toBe("/panel/purchases");
    expect(safeNextPath("/checkout/abc?ref=x")).toBe("/checkout/abc?ref=x");
  });

  it("refuses an absolute URL", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("refuses a protocol-relative URL, which a startsWith('/') check lets through", () => {
    // The whole reason this function exists.
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("//evil.example/login")).toBeNull();
  });

  it("refuses a backslash that a browser would normalise into //", () => {
    expect(safeNextPath("/\\evil.example")).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("   ")).toBeNull();
  });

  it("trims, because a form field can carry whitespace", () => {
    expect(safeNextPath("  /panel  ")).toBe("/panel");
  });
});
