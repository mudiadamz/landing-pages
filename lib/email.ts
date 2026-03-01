import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "onboarding@resend.dev";

export async function sendPurchaseConfirmationEmail(opts: {
  to: string;
  title: string;
  downloadUrl: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM,
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
        <p style="color:#666;font-size:12px">ADM.UIUX — Landing Page Template</p>
      `,
    });
  } catch (err) {
    console.error("Resend email error:", err);
  }
}
