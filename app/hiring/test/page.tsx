import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HiringTestForm } from "./form";

export const metadata: Metadata = {
  title: "Tes Skill — Landing Page Creator",
  description: "Ikuti tes skill untuk posisi Landing Page Creator di ADM.UIUX.",
};

export default async function HiringTestPage() {
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
          href="/hiring"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors mb-8 inline-block"
        >
          ← Kembali ke halaman hiring
        </Link>

        <div className="space-y-4 mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Tes Skill — Landing Page Creator
          </h1>
          <p className="text-[var(--muted)] text-sm sm:text-base leading-relaxed">
            Jawab 10 pertanyaan situasional di bawah — kami ingin tahu cara kerja dan pola pikirmu. Tidak ada jawaban yang bisa di-Google. Hasil akan dikirim ke email kamu dan tim kami.
          </p>
        </div>

        <HiringTestForm />
      </main>

      <SiteFooter />
    </div>
  );
}
