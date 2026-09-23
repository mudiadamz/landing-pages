import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The approve/reject notification (docs/plans/multi-business-saas.md, Fase 4).
 *
 * Two things worth pinning: it stays silent when Resend isn't configured (so a
 * deployment without an API key doesn't log an approval as a failure), and the
 * business NAME — which the applicant typed — is escaped before it lands inside
 * the HTML body.
 */

const send = vi.fn(async () => ({ data: { id: "e_1" }, error: null }));
vi.mock("resend", () => ({ Resend: class { emails = { send } } }));

const { sendBusinessDecisionEmail } = await import("@/lib/email");

const sent = () => send.mock.calls[0][0] as unknown as { subject: string; html: string; to: string };

beforeEach(() => {
  send.mockClear();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "no-reply@test.local");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://toko.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("sendBusinessDecisionEmail", () => {
  it("tanpa RESEND_API_KEY: tidak mengirim, tidak melempar", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendBusinessDecisionEmail({ to: "a@t.local", businessName: "Toko", approved: true })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("approve: menyebut domain yang di-provision dan menautkan panel business", async () => {
    await sendBusinessDecisionEmail({
      to: "a@t.local",
      businessName: "Toko Buku",
      approved: true,
      host: "tokobuku.test",
    });
    const mail = sent();
    expect(mail.to).toBe("a@t.local");
    expect(mail.subject).toContain("disetujui");
    expect(mail.html).toContain("tokobuku.test");
    expect(mail.html).toContain("https://toko.test/panel/business");
  });

  it("approve tanpa domain: tidak mengarang satu pun", async () => {
    await sendBusinessDecisionEmail({ to: "a@t.local", businessName: "Toko", approved: true, host: null });
    expect(sent().html).not.toContain("Storefront-nya sudah disiapkan");
  });

  it("reject: tidak mengklaim alasan yang tidak dimiliki sistem", async () => {
    await sendBusinessDecisionEmail({ to: "a@t.local", businessName: "Toko", approved: false });
    const mail = sent();
    expect(mail.subject).not.toContain("disetujui");
    expect(mail.html).toContain("balas email ini");
  });

  it("nama business di-escape sebelum masuk HTML", async () => {
    await sendBusinessDecisionEmail({
      to: "a@t.local",
      businessName: '<script>alert(1)</script>',
      approved: true,
    });
    expect(sent().html).not.toContain("<script>");
    expect(sent().html).toContain("&lt;script&gt;");
  });

  it("gagal kirim tidak melempar — keputusan sudah tertulis, email cuma kesopanan", async () => {
    send.mockRejectedValueOnce(new Error("Resend down"));
    expect(await sendBusinessDecisionEmail({ to: "a@t.local", businessName: "Toko", approved: true })).toBe(false);
  });
});
