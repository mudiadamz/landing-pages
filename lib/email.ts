import { Resend } from "resend";

export async function sendPurchaseConfirmationEmail(opts: {
  to: string;
  title: string;
  downloadUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return;
  }

  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: opts.to,
      subject: `Pembayaran berhasil — ${opts.title}`,
      html: `
        <h1>Pembayaran berhasil</h1>
        <p>Terima kasih atas pembelian Anda.</p>
        <p><strong>${opts.title}</strong></p>
        <p>Download file landing page (ZIP) di link berikut:</p>
        <p><a href="${opts.downloadUrl}">Download sekarang</a></p>
        <p>Atau masuk ke panel untuk mendownload kapan saja.</p>
        <hr>
        <p style="color:#666;font-size:12px">Storefront — Landing Page & Digital Assets</p>
      `,
    });
  } catch (err) {
    console.error("Resend email error:", err);
  }
}

/**
 * Tell an applicant what the Platform decided about their business
 * (docs/plans/multi-business-saas.md, Fase 4).
 *
 * Best-effort, like every other send in this codebase: the decision is already
 * written when this runs, and an approval that throws because Resend is having a
 * bad minute would leave a business active with the Platform believing it failed.
 * The panel shows the same status, so a lost email costs a visit, not the account.
 *
 * Rejection deliberately carries no reason field. There isn't one in the data —
 * inventing wording here would be the system claiming to know something it
 * doesn't. It points at support instead, where a human can answer.
 */
export async function sendBusinessDecisionEmail(opts: {
  to: string;
  businessName: string;
  approved: boolean;
  /** Storefront provisioned on approval, when the applicant asked for one. */
  host?: string | null;
  /** Origin for the panel link; falls back to the canonical site. */
  origin?: string | null;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping business decision email");
    return false;
  }

  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  const base = (opts.origin?.trim() || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const name = escapeHtml(opts.businessName);
  const panel = `${base}/panel/business`;

  const body = opts.approved
    ? `
        <h1>Business kamu disetujui</h1>
        <p><strong>${name}</strong> sudah aktif.</p>
        ${
          opts.host
            ? `<p>Storefront-nya sudah disiapkan di <strong>${escapeHtml(opts.host)}</strong>. Arahkan DNS domain itu ke server kami dan sertifikatnya terbit otomatis.</p>`
            : ""
        }
        <p>Langkah berikutnya: lengkapi rekening payout dan ajukan verifikasi (KYC) supaya saldo penjualan bisa dicairkan.</p>
        <p><a href="${panel}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Buka panel business</a></p>
      `
    : `
        <h1>Pengajuan business belum bisa kami setujui</h1>
        <p>Pengajuan untuk <strong>${name}</strong> tidak kami lanjutkan untuk saat ini.</p>
        <p>Kalau menurut kamu ini keliru, atau kamu mau melengkapi datanya dan mengajukan lagi, balas email ini dan kami bantu.</p>
      `;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.approved
        ? `Business "${opts.businessName}" disetujui`
        : `Pengajuan business "${opts.businessName}"`,
      html: `${body}
        <hr>
        <p style="color:#666;font-size:12px">Storefront — Landing Page &amp; Digital Assets</p>
      `,
    });
    return true;
  } catch (err) {
    console.error("sendBusinessDecisionEmail error:", err);
    return false;
  }
}

/** The business name is user-supplied and lands inside HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
