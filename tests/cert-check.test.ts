import { describe, expect, it } from "vitest";
import {
  CERT_RETRY_MS,
  EDGE_HEADER,
  isIssuingError,
  mayRetry,
  needsWarming,
  retryAfterSeconds,
  verdictFromResponse,
} from "@/lib/cert-check";

const NOW = new Date("2026-09-24T12:00:00Z");

const headers = (h: Record<string, string>) => ({
  get: (name: string) => h[name.toLowerCase()] ?? null,
});

describe("verdictFromResponse", () => {
  it("is ready only when the answer came from our edge", () => {
    expect(verdictFromResponse(headers({ [EDGE_HEADER]: "1" }))).toEqual({ state: "ready" });
  });

  /**
   * The false positive this whole check exists to avoid.
   *
   * An earlier version asked only "is there a valid certificate for this host",
   * and reported techgalery.com ready while its DNS still pointed at Blogger —
   * Google serves a perfectly valid certificate for it. A valid certificate
   * proves somebody is serving the domain, not that we are.
   */
  it("reports 'elsewhere' when a valid HTTPS response came from someone else", () => {
    expect(verdictFromResponse(headers({ server: "GSE" }))).toEqual({ state: "elsewhere" });
    expect(verdictFromResponse(headers({ server: "cloudflare" }))).toEqual({ state: "elsewhere" });
  });
});

describe("isIssuingError", () => {
  it("knows the shapes of 'still working on it'", () => {
    for (const code of ["ETIMEDOUT", "ECONNRESET", "EPROTO", "UND_ERR_CONNECT_TIMEOUT"]) {
      expect(isIssuingError(code), code).toBe(true);
    }
  });

  it("does not excuse a real failure", () => {
    for (const code of ["ENOTFOUND", "ECONNREFUSED", "CERT_HAS_EXPIRED", undefined]) {
      expect(isIssuingError(code), String(code)).toBe(false);
    }
  });
});

describe("backoff", () => {
  it("allows a first attempt", () => {
    expect(mayRetry(null, NOW)).toBe(true);
    expect(retryAfterSeconds(null, NOW)).toBe(0);
  });

  /**
   * Let's Encrypt allows 5 failed validations per hostname per hour. A button
   * with no backoff is the fastest way for an impatient owner to lock their own
   * domain out for an hour — and it would look like our bug, not their haste.
   */
  it("refuses a second attempt inside the window, and says how long to wait", () => {
    const justNow = new Date(NOW.getTime() - 60_000).toISOString();
    expect(mayRetry(justNow, NOW)).toBe(false);
    expect(retryAfterSeconds(justNow, NOW)).toBe(240);
  });

  it("allows it again once the window passes", () => {
    const old = new Date(NOW.getTime() - CERT_RETRY_MS - 1000).toISOString();
    expect(mayRetry(old, NOW)).toBe(true);
  });

  it("survives a garbage timestamp rather than blocking forever", () => {
    expect(mayRetry("not a date", NOW)).toBe(true);
  });
});

describe("needsWarming", () => {
  it("skips a domain nobody has proven yet", () => {
    expect(needsWarming({ verifiedAt: null, certReadyAt: null }, NOW)).toBe(false);
  });

  it("picks up a verified domain we have never served", () => {
    expect(needsWarming({ verifiedAt: "2026-09-01T00:00:00Z", certReadyAt: null }, NOW)).toBe(true);
  });

  it("leaves a recently confirmed domain alone — Caddy renews its own", () => {
    expect(
      needsWarming({ verifiedAt: "2026-09-01T00:00:00Z", certReadyAt: "2026-09-20T00:00:00Z" }, NOW),
    ).toBe(false);
  });

  it("picks one up again once a renewal should have happened since", () => {
    expect(
      needsWarming({ verifiedAt: "2026-01-01T00:00:00Z", certReadyAt: "2026-05-01T00:00:00Z" }, NOW),
    ).toBe(true);
  });
});
