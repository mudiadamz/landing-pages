import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { hiringQuestions } from "@/lib/hiring-questions";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const cvFile = formData.get("cv") as File | null;

  if (!name || !email) {
    return NextResponse.json({ error: "Nama dan email wajib diisi." }, { status: 400 });
  }

  if (!cvFile || cvFile.size === 0) {
    return NextResponse.json({ error: "CV wajib diupload." }, { status: 400 });
  }

  if (cvFile.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Ukuran CV melebihi 5 MB." }, { status: 400 });
  }

  const cvBase64 = Buffer.from(await cvFile.arrayBuffer()).toString("base64");

  const results = hiringQuestions.map((q) => {
    const raw = formData.get(`q${q.id}`);
    const selected = raw !== null ? Number(raw) : -1;
    return { question: q.question, selected, correctIndex: q.answer, correct: selected === q.answer };
  });

  const score = results.filter((r) => r.correct).length;
  const total = hiringQuestions.length;

  const detailRows = results
    .map((r, i) => {
      const q = hiringQuestions[i];
      const selectedLabel = r.selected >= 0 ? q.options[r.selected] : "Tidak dijawab";
      const correctLabel = q.options[r.correctIndex];
      const icon = r.correct ? "&#9989;" : "&#10060;";
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top">${icon}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">
            <strong>${q.question}</strong><br>
            <span style="color:#666">Jawaban: ${selectedLabel}</span>
            ${!r.correct ? `<br><span style="color:#1a5f4a">Ideal: ${correctLabel}</span>` : ""}
          </td>
        </tr>`;
    })
    .join("");

  const scoreColor = score >= total * 0.7 ? "#1a5f4a" : score >= total * 0.4 ? "#e8a87c" : "#e27d60";

  const adminHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="margin-bottom:4px">Hasil Tes Pelamar</h2>
      <p style="color:#666;margin-top:0">ADM.UIUX</p>
      <p><strong>Nama:</strong> ${name}<br><strong>Email:</strong> ${email}</p>
      <p style="font-size:32px;font-weight:700;color:${scoreColor};margin:8px 0">${score} / ${total}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        ${detailRows}
      </table>
      <hr style="margin-top:24px">
      <p style="color:#666;font-size:12px">ADM.UIUX — Landing Page & Digital Assets</p>
    </div>
  `;

  const applicantHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="margin-bottom:4px">Lamaran Terkirim</h2>
      <p style="color:#666;margin-top:0">ADM.UIUX</p>
      <p>Halo <strong>${name}</strong>,</p>
      <p>Terima kasih sudah mengisi tes dan mengirimkan CV kamu untuk posisi <strong>Landing Page Creator</strong>.</p>
      <p>Lamaran kamu sudah kami terima. Tim kami akan me-review dan menghubungi kamu jika sesuai.</p>
      <hr style="margin-top:24px">
      <p style="color:#666;font-size:12px">ADM.UIUX — Landing Page & Digital Assets</p>
    </div>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
    const resend = new Resend(apiKey);
    const cvFilename = `CV_${name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    const [applicantRes, adminRes] = await Promise.all([
      resend.emails.send({
        from,
        to: email,
        subject: "Lamaran Terkirim — Landing Page Creator | ADM.UIUX",
        html: applicantHtml,
      }),
      resend.emails.send({
        from,
        to: "admin@admuiux.com",
        subject: `Hasil Tes Pelamar — ${name} (${score}/${total})`,
        html: adminHtml,
        attachments: [
          {
            filename: cvFilename,
            content: cvBase64,
          },
        ],
      }),
    ]);

    if (applicantRes.error) {
      console.error("Hiring test: applicant email error", applicantRes.error);
    }
    if (adminRes.error) {
      console.error("Hiring test: admin email error", adminRes.error);
    }
  }

  const redirectUrl = `/hiring/test/result?name=${encodeURIComponent(name)}`;
  return NextResponse.json({ redirectUrl });
}
