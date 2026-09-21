import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeGoogleCode, returnHostFromState, startGoogle, type OAuthPending } from "@/lib/backend/google";

/**
 * Google sign-in without an SDK (lib/backend/google.ts). Google itself is
 * replaced by a stubbed fetch; what is tested is everything on our side of the
 * wire: PKCE, the state that carries the storefront, and the id_token checks
 * that stand in for a signature check.
 */

const CLIENT_ID = "klien-uji.apps.googleusercontent.com";

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = "rahasia";
});
afterEach(() => vi.unstubAllGlobals());

const jwt = (claims: object) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "tanda-tangan"].join(".");

const good = (over: object = {}) => ({
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  sub: "1234567890",
  email: "Orang@Gmail.com",
  email_verified: true,
  name: "Orang",
  exp: Math.floor(Date.now() / 1000) + 600,
  ...over,
});

function stubToken(claims: object, status = 200) {
  const calls: { url: string; body: URLSearchParams }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(init.body as URLSearchParams) });
    return new Response(JSON.stringify({ id_token: jwt(claims) }), { status });
  });
  return calls;
}

const pending: OAuthPending = { state: "s", verifier: "v".repeat(43), redirectUri: "https://toko.example/auth/callback", next: null };

describe("startGoogle", () => {
  it("PKCE S256: challenge di URL = sha256(verifier) yang disimpan", () => {
    const { url, pending: p } = startGoogle({ redirectUri: "https://toko.example/auth/callback", returnHost: null, next: "/checkout/a" });
    const q = new URL(url).searchParams;
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("code_challenge")).toBe(createHash("sha256").update(p.verifier).digest("base64url"));
    expect(q.get("state")).toBe(p.state);
    expect(q.get("redirect_uri")).toBe(p.redirectUri);
    expect(q.get("client_id")).toBe(CLIENT_ID);
    expect(p.next).toBe("/checkout/a");
  });

  it("state baru setiap kali, dan membawa storefront asal kalau ada", () => {
    const a = startGoogle({ redirectUri: "x", returnHost: "resep.admuiux.com", next: null }).pending;
    const b = startGoogle({ redirectUri: "x", returnHost: "resep.admuiux.com", next: null }).pending;
    expect(a.state).not.toBe(b.state);
    expect(returnHostFromState(a.state)).toBe("resep.admuiux.com");
    expect(returnHostFromState(startGoogle({ redirectUri: "x", returnHost: null, next: null }).pending.state)).toBeNull();
  });

  it("tanpa GOOGLE_CLIENT_ID/SECRET menolak mulai", () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(() => startGoogle({ redirectUri: "x", returnHost: null, next: null })).toThrow();
  });
});

describe("exchangeGoogleCode", () => {
  it("mengirim verifier dan redirect_uri yang sama dengan saat berangkat", async () => {
    const calls = stubToken(good());
    const claims = await exchangeGoogleCode("kode", pending);
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0].body.get("code_verifier")).toBe(pending.verifier);
    expect(calls[0].body.get("redirect_uri")).toBe(pending.redirectUri);
    expect(calls[0].body.get("code")).toBe("kode");
    expect(claims).toMatchObject({ sub: "1234567890", email: "Orang@Gmail.com", email_verified: true, name: "Orang" });
  });

  it.each([
    ["aud milik aplikasi lain", { aud: "lain.apps.googleusercontent.com" }],
    ["penerbit bukan Google", { iss: "https://evil.example" }],
    ["sudah kedaluwarsa", { exp: Math.floor(Date.now() / 1000) - 10 }],
    ["tanpa sub", { sub: undefined }],
  ])("id_token ditolak: %s", async (_, over) => {
    stubToken(good(over));
    await expect(exchangeGoogleCode("kode", pending)).rejects.toThrow();
  });

  it("Google menolak kodenya → gagal", async () => {
    stubToken(good(), 400);
    await expect(exchangeGoogleCode("kode", pending)).rejects.toThrow();
  });

  it("email_verified yang bukan true dibaca sebagai belum terverifikasi", async () => {
    stubToken(good({ email_verified: "no" }));
    expect((await exchangeGoogleCode("kode", pending)).email_verified).toBe(false);
  });
});
