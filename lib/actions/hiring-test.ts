"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { hiringQuestions } from "@/lib/hiring-questions";

export async function submitHiringTest(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const cvFile = formData.get("cv") as File | null;

  if (!name || !email) {
    throw new Error("Nama dan email wajib diisi.");
  }

  if (!cvFile || cvFile.size === 0) {
    throw new Error("CV wajib diupload.");
  }

  if (cvFile.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran CV melebihi 5 MB.");
  }

  const cvBuffer = Buffer.from(await cvFile.arrayBuffer());

  const results = hiringQuestions.map((q) => {
    const raw = formData.get(`q${q.id}`);
    const selected = raw !== null ? Number(raw) : -1;
    const correct = selected === q.answer;
    return { question: q.question, selected, correctIndex: q.answer, correct };
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

  const htmlBody = (forAdmin: boolean) => `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="margin-bottom:4px">Hasil Tes — Landing Page Creator</h2>
      <p style="color:#666;margin-top:0">ADM.UIUX</p>
      ${forAdmin ? `<p><strong>Nama:</strong> ${name}<br><strong>Email:</strong> ${email}</p>` : `<p>Halo <strong>${name}</strong>,</p>`}
      <p>Skor kamu:</p>
      <p style="font-size:32px;font-weight:700;color:${scoreColor};margin:8px 0">${score} / ${total}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        ${detailRows}
      </table>
      <hr style="margin-top:24px">
      <p style="color:#666;font-size:12px">ADM.UIUX — Landing Page & Digital Assets</p>
    </div>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
    const resend = new Resend(apiKey);

    await Promise.all([
      resend.emails.send({
        from,
        to: email,
        subject: `Hasil Tes — Landing Page Creator | ADM.UIUX`,
        html: htmlBody(false),
      }),
      resend.emails.send({
        from,
        to: "admin@admuiux.com",
        subject: `Hasil Tes Pelamar — ${name} (${score}/${total})`,
        html: htmlBody(true),
        attachments: [
          {
            filename: `CV_${name.replace(/\s+/g, "_")}.pdf`,
            content: cvBuffer,
          },
        ],
      }),
    ]).catch((err) => {
      console.error("Hiring test email error:", err);
    });
  }

  redirect(`/hiring/test/result?score=${score}&total=${total}&name=${encodeURIComponent(name)}`);
}
