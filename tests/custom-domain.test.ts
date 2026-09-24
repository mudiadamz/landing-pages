import { describe, expect, it } from "vitest";
import {
  cnameMatches,
  customHostProblem,
  domainState,
  isApex,
  normalizeCustomHost,
  registrableDomain,
  txtMatches,
  verificationHost,
  verificationValue,
} from "@/lib/custom-domain";

describe("normalizeCustomHost", () => {
  it("accepts what people actually paste", () => {
    for (const raw of [
      "shop.merek.com",
      "  Shop.Merek.com  ",
      "https://shop.merek.com/",
      "http://shop.merek.com:8080/path?x=1",
      "shop.merek.com.",
    ]) {
      expect(normalizeCustomHost(raw), raw).toBe("shop.merek.com");
    }
  });

  it("survives nothing at all", () => {
    expect(normalizeCustomHost(null)).toBe("");
    expect(normalizeCustomHost("   ")).toBe("");
  });
});

describe("registrable domain and apex", () => {
  it("handles ordinary two-label TLDs", () => {
    expect(registrableDomain("shop.merek.com")).toBe("merek.com");
    expect(isApex("merek.com")).toBe(true);
    expect(isApex("shop.merek.com")).toBe(false);
  });

  /**
   * The case a plain label-count check gets wrong: `merek.co.id` has three
   * labels and is still an apex, so accepting it would send the customer to
   * create a CNAME their registrar will refuse.
   */
  it("knows a second-level registry is still an apex", () => {
    expect(registrableDomain("merek.co.id")).toBe("merek.co.id");
    expect(isApex("merek.co.id")).toBe(true);
    expect(isApex("shop.merek.co.id")).toBe(false);
    expect(registrableDomain("shop.merek.co.id")).toBe("merek.co.id");
  });

  it("handles a deep subdomain", () => {
    expect(isApex("a.b.shop.merek.com")).toBe(false);
    expect(registrableDomain("a.b.shop.merek.com")).toBe("merek.com");
  });
});

describe("customHostProblem", () => {
  it("accepts a subdomain, which is the whole supported shape", () => {
    expect(customHostProblem("shop.merek.com")).toBeNull();
    expect(customHostProblem("toko.merek.co.id")).toBeNull();
  });

  it("names the reason instead of just refusing", () => {
    expect(customHostProblem("")).toBe("empty");
    expect(customHostProblem("merek.com")).toBe("apex");
    expect(customHostProblem("merek.co.id")).toBe("apex");
    expect(customHostProblem("mbahgpt.com")).toBe("reserved");
    expect(customHostProblem("shop..merek.com")).toBe("invalid");
    expect(customHostProblem("-shop.merek.com")).toBe("invalid");
    expect(customHostProblem("shop.merek.123")).toBe("invalid");
    expect(customHostProblem("shop")).toBe("invalid");
  });

  it("rejects a host that is too long to exist", () => {
    expect(customHostProblem(`${"a".repeat(250)}.merek.com`)).toBe("too-long");
  });
});

describe("the TXT proof", () => {
  it("puts the record where other vendors put theirs", () => {
    expect(verificationHost("shop.merek.com")).toBe("_adm-verify.shop.merek.com");
    expect(verificationValue("abc123")).toBe("adm-verify=abc123");
  });

  it("matches the record", () => {
    expect(txtMatches([["adm-verify=abc123"]], "abc123")).toBe(true);
  });

  /**
   * TXT is stored in 255-byte chunks and resolvers hand them back separately.
   * A token split across two chunks is a perfectly correct record that a naive
   * comparison reports as missing.
   */
  it("joins the chunks a resolver splits a long record into", () => {
    expect(txtMatches([["adm-verify=", "abc123"]], "abc123")).toBe(true);
  });

  it("ignores every other record on the same name", () => {
    const records = [["v=spf1 include:_spf.google.com ~all"], ["google-site-verification=xyz"], ["adm-verify=abc123"]];
    expect(txtMatches(records, "abc123")).toBe(true);
  });

  it("does not match a different token, or a near miss", () => {
    expect(txtMatches([["adm-verify=abc124"]], "abc123")).toBe(false);
    expect(txtMatches([["abc123"]], "abc123")).toBe(false);
    expect(txtMatches([], "abc123")).toBe(false);
  });
});

describe("the CNAME check", () => {
  it("ignores the trailing dot and case a resolver returns", () => {
    expect(cnameMatches(["Edge.MbahGPT.com."], "edge.mbahgpt.com")).toBe(true);
  });

  it("is false when it points somewhere else", () => {
    expect(cnameMatches(["ghs.googlehosted.com."], "edge.mbahgpt.com")).toBe(false);
    expect(cnameMatches([], "edge.mbahgpt.com")).toBe(false);
  });
});

describe("domainState", () => {
  it("separates 'not proven' from 'proven but no traffic yet'", () => {
    expect(domainState({ verifiedAt: null, cnameOk: false })).toBe("unverified");
    expect(domainState({ verifiedAt: null, cnameOk: true })).toBe("unverified");
    expect(domainState({ verifiedAt: "2026-09-24T00:00:00Z", cnameOk: false })).toBe("verified");
    expect(domainState({ verifiedAt: "2026-09-24T00:00:00Z", cnameOk: true })).toBe("live");
  });
});
