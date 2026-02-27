import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLandingPagesForHomepage } from "@/lib/actions/landing-pages";
import { LandingPageCard } from "./landing-page-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Testimonials } from "@/components/testimonials";
import { Disclaimer } from "@/components/disclaimer";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pages = await getLandingPagesForHomepage();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} />

      <main className="flex-1">
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-24">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight text-foreground">
              Temukan landing page
            </h1>
            <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
              Jelajahi, lihat preview, dan beli HTML landing page siap pakai. Template gratis dan berbayar.
            </p>
          </div>
        </section>

        {pages.length === 0 ? (
          <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 py-12 sm:py-16 px-6 sm:px-8 text-center">
              <p className="text-[var(--muted)]">Belum ada landing page.</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                <Link href="/signup" className="font-medium text-[var(--primary)] hover:opacity-80 transition-opacity">
                  Daftar
                </Link>{" "}
                untuk membuat dan menjual landing page pertamamu.
              </p>
            </div>
          </section>
        ) : (
          <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {pages.map((page) => (
                <LandingPageCard key={page.id} page={page} isLoggedIn={!!user} />
              ))}
            </div>
          </section>
        )}

        <Testimonials />
        <Disclaimer />
      </main>

      <SiteFooter />
    </div>
  );
}
