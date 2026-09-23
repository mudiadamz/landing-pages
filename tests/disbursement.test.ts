import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disburse, disbursementConfig, type DisbursementConfig } from "@/lib/disbursement";

/**
 * Duitku Disbursement — the OUTBOUND money path (docs/plans/multi-business-saas.md,
 * Fase 3).
 *
 * What is pinned here is not "does the HTTP call work" but the one judgement the
 * module exists to make: which provider answers mean the caller may take the
 * money back. Getting that wrong in the safe direction costs a reconciliation;
 * getting it wrong in the other direction pays a business twice.
 *
 * fetch is stubbed — no sandbox credentials in CI, and the signature/step order
 * is exactly what needs asserting anyway.
 */

const cfg: DisbursementConfig = {
  userId: "3551",
  email: "merchant@test.local",
  secret: "rahasia",
  sandbox: true,
};

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[];

/** Queue one JSON response per fetch, in order. `null` = an unreadable body. */
function stubFetch(responses: Array<Record<string, unknown> | null | Error>) {
  const queue = [...responses];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return {
      json: async () => {
        if (next === null) throw new SyntaxError("bukan JSON");
        return next;
      },
    } as Response;
  });
}

const okInquiry = {
  responseCode: "00",
  disburseId: "D-1",
  custRefNumber: "123456789",
  accountName: "BUDI SANTOSO",
};

const req = { amount: 100_000, bankCode: "014", bankAccount: "1234567890", purpose: "Payout uji" };

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("disbursementConfig", () => {
  it("null selama salah satu kredensial kosong — payout otomatis mati by default", () => {
    vi.stubEnv("DUITKU_DISBURSE_USER_ID", "");
    vi.stubEnv("DUITKU_DISBURSE_EMAIL", "");
    vi.stubEnv("DUITKU_DISBURSE_SECRET", "");
    expect(disbursementConfig()).toBeNull();

    vi.stubEnv("DUITKU_DISBURSE_USER_ID", "3551");
    vi.stubEnv("DUITKU_DISBURSE_EMAIL", "m@t.local");
    expect(disbursementConfig(), "secret masih kosong").toBeNull();
  });

  it("sandbox adalah default; produksi harus diminta eksplisit", () => {
    vi.stubEnv("DUITKU_DISBURSE_USER_ID", "3551");
    vi.stubEnv("DUITKU_DISBURSE_EMAIL", "m@t.local");
    vi.stubEnv("DUITKU_DISBURSE_SECRET", "s");
    vi.stubEnv("DUITKU_DISBURSE_SANDBOX", "");
    expect(disbursementConfig()?.sandbox).toBe(true);
    vi.stubEnv("DUITKU_DISBURSE_SANDBOX", "false");
    expect(disbursementConfig()?.sandbox).toBe(false);
  });
});

describe("disburse — dua langkah", () => {
  it("inquiry dulu, lalu transfer yang mengutip disburseId/custRefNumber/accountName", async () => {
    stubFetch([okInquiry, { responseCode: "00" }]);
    const res = await disburse(cfg, req);

    expect(res).toEqual({
      status: "sent",
      providerRef: "D-1",
      custRef: "123456789",
      accountName: "BUDI SANTOSO",
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/inquirysandbox");
    expect(calls[1].url).toContain("/transfersandbox");
    expect(calls[1].body).toMatchObject({
      disburseId: "D-1",
      custRefNumber: "123456789",
      accountName: "BUDI SANTOSO",
      amountTransfer: 100_000,
      bankCode: "014",
    });
    // Signatures are hex sha256 and differ between the two steps (different formula).
    expect(String(calls[0].body.signature)).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[1].body.signature).not.toBe(calls[0].body.signature);
  });

  it("produksi memakai host lain, bukan path sandbox", async () => {
    stubFetch([okInquiry, { responseCode: "00" }]);
    await disburse({ ...cfg, sandbox: false }, req);
    expect(calls[0].url).toBe("https://passport.duitku.com/webapi/api/disbursement/inquiry");
    expect(calls[1].url).toBe("https://passport.duitku.com/webapi/api/disbursement/transfer");
  });
});

describe("disburse — kegagalan inquiry aman dibalik (belum ada uang bergerak)", () => {
  it("inquiry ditolak → failed, transfer tidak pernah dipanggil", async () => {
    stubFetch([{ responseCode: "-510", responseDesc: "Saldo tidak cukup" }]);
    const res = await disburse(cfg, req);
    expect(res.status).toBe("failed");
    expect(calls).toHaveLength(1);
  });

  it("inquiry melempar (jaringan) → failed", async () => {
    stubFetch([new Error("ECONNRESET")]);
    expect((await disburse(cfg, req)).status).toBe("failed");
  });

  it("inquiry sukses tapi tidak lengkap → failed, bukan transfer dengan field kosong", async () => {
    stubFetch([{ responseCode: "00", disburseId: "D-1" }]);
    expect((await disburse(cfg, req)).status).toBe("failed");
    expect(calls).toHaveLength(1);
  });
});

describe("disburse — sesudah transfer dikirim, 'tidak tahu' BUKAN 'gagal'", () => {
  it("transfer timeout/melempar → pending, disburseId tetap dilaporkan", async () => {
    stubFetch([okInquiry, new Error("timeout")]);
    const res = await disburse(cfg, req);
    expect(res.status).toBe("pending");
    expect(res).toMatchObject({ providerRef: "D-1" });
  });

  it("jawaban transfer tidak terbaca → pending", async () => {
    stubFetch([okInquiry, null]);
    expect((await disburse(cfg, req)).status).toBe("pending");
  });

  it.each(["68", "80", "TO"])("kode tunggu Duitku %s → pending, bukan failed", async (code) => {
    stubFetch([okInquiry, { responseCode: code, responseDesc: "tunggu" }]);
    expect((await disburse(cfg, req)).status).toBe("pending");
  });

  it("penolakan eksplisit → failed (pemanggil boleh mengembalikan saldo)", async () => {
    stubFetch([okInquiry, { responseCode: "-100", responseDesc: "Ditolak bank" }]);
    const res = await disburse(cfg, req);
    expect(res.status).toBe("failed");
    expect(res).toMatchObject({ message: expect.stringContaining("-100") });
  });
});

describe("disburse — validasi sebelum menyentuh jaringan", () => {
  it.each([0, -1, Number.NaN])("jumlah %s ditolak tanpa request", async (amount) => {
    stubFetch([]);
    expect((await disburse(cfg, { ...req, amount })).status).toBe("failed");
    expect(calls).toHaveLength(0);
  });
});
