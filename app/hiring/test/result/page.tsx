import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Hasil Tes — Landing Page Creator",
};

type Props = { searchParams: Promise<{ score?: string; total?: string; name?: string }> };

export default async function HiringTestResultPage({ searchParams }: Props) {
  const { score: rawScore, total: rawTotal, name } = await searchParams;
  const score = Number(rawScore) || 0;
  const total = Number(rawTotal) || 10;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const supabase = await createClient();
  const [{ data: { user } }, categories] = await Promise.all([
    supabase.auth.getUser(),
    getCategories(),
  ]);

  const isPassing = pct >= 70;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} categories={categories} />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: isPassing ? "rgba(26,95,74,0.15)" : "rgba(232,168,124,0.2)" }}>
          {isPassing ? (
            <svg className="w-8 h-8 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-[var(--accent-warm)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              <circle cx={12} cy={12} r={10} strokeWidth={2} />
            </svg>
          )}
        </div>

        <h1 className="text-xl font-semibold text-foreground mb-2">
          {name ? `Terima kasih, ${decodeURIComponent(name)}!` : "Tes selesai!"}
        </h1>

        <p className="text-4xl font-bold mb-1" style={{ color: isPassing ? "var(--primary)" : "var(--accent-warm)" }}>
          {score} / {total}
        </p>
        <p className="text-sm text-[var(--muted)] mb-6">
          Skor kamu: {pct}%
        </p>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 w-full max-w-md mb-8">
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Hasil tes beserta detail jawaban telah dikirim ke <strong className="text-foreground">email kamu</strong> dan <strong className="text-foreground">tim ADM.UIUX</strong>. Kami akan menghubungi kamu jika sesuai.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/hiring"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
          >
            Kembali ke Hiring
          </Link>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition-colors"
          >
            Beranda
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
