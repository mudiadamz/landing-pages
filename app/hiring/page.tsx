import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hiringQuestions } from "@/lib/hiring-questions";
import { getCategories } from "@/lib/actions/landing-pages";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Hiring — Landing Page Creator",
  description:
    "Bergabung dengan ADM.UIUX sebagai Landing Page Creator. Remote, fleksibel, dan kreatif.",
};

const requirements = [
  "Menguasai UI/UX design — paham layout, tipografi, warna, dan hierarki visual",
  "Mahir HTML, CSS, dan JavaScript — bisa slicing dari desain ke kode bersih dan responsif",
  "Familiar dengan Figma atau design tool lain (nilai lebih)",
  "Mampu membuat minimal 1 landing page per hari",
  "Teliti, mandiri, dan komunikatif",
];

const benefits = [
  "Full remote — kerja dari mana saja",
  "Waktu fleksibel",
  "Portofolio dipublikasikan di platform ADM.UIUX",
  "Support dan feedback langsung dari tim",
];

export default async function HiringPage() {
  const supabase = await createClient();
  const [{ data: { user } }, categories] = await Promise.all([
    supabase.auth.getUser(),
    getCategories(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} categories={categories} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors mb-8 inline-block"
        >
          ← Kembali ke beranda
        </Link>

        <div className="space-y-10">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-xs font-medium text-[var(--primary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
              Open Position
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Landing Page Creator
            </h1>
            <p className="text-[var(--muted)] text-base sm:text-lg leading-relaxed">
              Kami mencari orang kreatif yang bisa membuat landing page berkualitas tinggi secara konsisten. Posisi ini <strong className="text-foreground">full remote</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8 space-y-6">
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-subtle)] text-foreground border border-[var(--border)]">
                Remote
              </span>
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-subtle)] text-foreground border border-[var(--border)]">
                Landing Page
              </span>
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-subtle)] text-foreground border border-[var(--border)]">
                UI/UX + Code
              </span>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">Scope pekerjaan</h2>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Membuat landing page dari brief atau referensi. Output berupa file HTML/CSS/JS yang bersih, responsif, dan siap pakai. Landing page akan dipublikasikan di platform ADM.UIUX.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Kualifikasi</h2>
              <ul className="space-y-2.5">
                {requirements.map((req, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--muted)]">
                    <svg className="w-5 h-5 shrink-0 text-[var(--primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Yang kamu dapat</h2>
              <ul className="space-y-2.5">
                {benefits.map((b, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--muted)]">
                    <svg className="w-5 h-5 shrink-0 text-[var(--accent-cool)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-5 sm:p-8 text-center space-y-4">
            <h2 className="text-base font-semibold text-foreground">Tertarik? Ikuti tes skill</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed max-w-md mx-auto">
              Jawab {hiringQuestions.length} pertanyaan situasional tentang cara kerja kamu dan upload CV. Hasil langsung dikirim ke email kamu dan tim kami.
            </p>
            <Link
              href="/hiring/test"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-95 active:scale-[0.98] transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Mulai tes
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
