import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLandingPagesForHomepage } from "@/lib/actions/landing-pages";
import { LandingPageCard } from "./landing-page-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Testimonials } from "@/components/testimonials";
import { Disclaimer } from "@/components/disclaimer";
import { HomeHero } from "@/components/home-hero";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pages = await getLandingPagesForHomepage();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} />

      <main className="flex-1 relative">
        <HomeHero />

        {pages.length === 0 ? (
          <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 py-12 sm:py-16 px-6 sm:px-8 text-center animate-fade-in-up hover:shadow-lg transition-shadow duration-300">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 landing-grid">
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
