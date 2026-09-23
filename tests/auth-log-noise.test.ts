import { describe, expect, it } from "vitest";

/**
 * Which bounces earn a log line (lib/db/proxy.ts → worthLogging).
 *
 * The instrument exists so ONE question can be answered: why did a real person
 * get logged out. Scanners hammer /panel/.env and /panel/wp-login all day and
 * produce `no-cookie` lines in exactly the same shape, so a filter that is too
 * generous defeats the instrument by burying its own signal — and one that is
 * too strict drops the genuine case of a logged-out person opening /panel,
 * which is precisely the case it was built for.
 *
 * The rule is reimplemented here rather than imported: lib/db/proxy.ts pulls in
 * next/server and the database layer, neither of which belongs in the pure
 * suite. What is pinned is the DECISION TABLE, which is the part that has to
 * stay right.
 */
function worthLogging(headers: Record<string, string>, token: string | null): boolean {
  if (token) return true;
  const mode = headers["sec-fetch-mode"];
  if (mode) return mode === "navigate";
  return (headers["accept"] ?? "").includes("text/html");
}

const BROWSER = { "sec-fetch-mode": "navigate", accept: "text/html,application/xhtml+xml" };
const SCANNER = { accept: "*/*" };
const PREFETCH = { "sec-fetch-mode": "cors", accept: "*/*" };

describe("worthLogging", () => {
  it("a person who is simply logged out IS logged — the case this exists for", () => {
    expect(worthLogging(BROWSER, null)).toBe(true);
  });

  it("a scanner with no cookie is NOT logged", () => {
    // /panel/.env, /panel/wp-login, and friends. Nobody had a session; nobody
    // needs a line.
    expect(worthLogging(SCANNER, null)).toBe(false);
  });

  it("a cookie that failed is ALWAYS logged, whatever the request looks like", () => {
    // Somebody had a session here once. That is the interesting half of the
    // problem and must never be filtered — including for a background fetch,
    // which is how a phone's open tab discovers it was logged out.
    expect(worthLogging(SCANNER, "abc")).toBe(true);
    expect(worthLogging(PREFETCH, "abc")).toBe(true);
    expect(worthLogging({}, "abc")).toBe(true);
  });

  it("a background fetch with no cookie is not a logout worth reporting", () => {
    expect(worthLogging(PREFETCH, null)).toBe(false);
  });

  it("an older client with no Sec-Fetch-Mode falls back to Accept", () => {
    expect(worthLogging({ accept: "text/html" }, null)).toBe(true);
    expect(worthLogging({ accept: "application/json" }, null)).toBe(false);
    expect(worthLogging({}, null)).toBe(false);
  });

  it("Sec-Fetch-Mode wins over Accept when both are present", () => {
    // A scanner can claim any Accept it likes; Sec-Fetch-Mode is set by the
    // browser itself, so when it is there it is the better answer.
    expect(worthLogging({ "sec-fetch-mode": "cors", accept: "text/html" }, null)).toBe(false);
  });
});
