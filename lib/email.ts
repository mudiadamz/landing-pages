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
        <p style="color:#666;font-size:12px">ADM.UIUX — Landing Page & Digital Assets</p>
      `,
    });
  } catch (err) {
    console.error("Resend email error:", err);
  }
}
