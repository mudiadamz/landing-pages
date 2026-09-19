import { describe, expect, it, vi } from "vitest";

/**
 * The gate on the OAuth hand-off between domains.
 *
 * Google sign-in on a niche storefront returns to the canonical callback with
 * `?sf=<host>`, and the canonical callback FORWARDS the authorization code to
 * that host. If `sf` could name any host, anyone could point it at a domain
 * they own and be handed a visitor's code. resolveReturnHost is the check:
 * only hosts that are rows in lp_sites.
 *
 * listSites() is mocked (it reads through Next's cache); normalizeHost is the
 * real one, because host normalisation is half of what makes the gate hold.
 */

vi.mock("@/lib/site-resolve", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/site-resolve")>();
  return {
    ...real,
    listSites: async () => [
      { host: "admuiux.com", active: true },
      { host: "resep.admuiux.com", active: true },
      { host: "Pustaka.Example", active: true },
      { host: "parked.example", active: false },
    ],
  };
});

const { resolveReturnHost } = await import("@/lib/oauth-return");

describe("resolveReturnHost", () => {
  it("menerima domain milik kita", async () => {
    expect(await resolveReturnHost("resep.admuiux.com")).toBe("resep.admuiux.com");
  });

  it("menormalkan huruf besar-kecil di kedua sisi", async () => {
    expect(await resolveReturnHost("RESEP.admuiux.COM")).toBe("resep.admuiux.com");
    expect(await resolveReturnHost("pustaka.example")).toBe("pustaka.example");
  });

  it("menolak domain asing — inilah yang mencegah kode otorisasi dikirim ke penyerang", async () => {
    expect(await resolveReturnHost("evil.example")).toBeNull();
  });

  it("menolak domain yang cuma MIRIP milik kita", async () => {
    expect(await resolveReturnHost("admuiux.com.evil.example")).toBeNull();
    expect(await resolveReturnHost("evil-admuiux.com")).toBeNull();
    expect(await resolveReturnHost("xresep.admuiux.com")).toBeNull();
  });

  it("menerima situs yang sedang nonaktif — pertanyaannya kepemilikan, bukan status", async () => {
    // Both sides of the hand-off must answer the same way, or a site switched
    // off mid-login strands the visitor on the wrong host.
    expect(await resolveReturnHost("parked.example")).toBe("parked.example");
  });

  it("kosong atau tidak ada = tidak ada tujuan", async () => {
    expect(await resolveReturnHost(null)).toBeNull();
    expect(await resolveReturnHost("")).toBeNull();
    expect(await resolveReturnHost("   ")).toBeNull();
  });
});
