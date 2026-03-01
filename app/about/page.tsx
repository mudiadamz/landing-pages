import type { Metadata } from "next";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SocialLinks } from "@/components/social-links";

export const metadata: Metadata = {
  title: "Tentang",
  description:
    "Tentang ADM.UIUX dan Adam Mudianto. Template landing page HTML siap pakai, software developer 15+ tahun.",
};

export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} />
      <main className="flex-1">
        {/* Background 1920x1080 */}
        <section
          className="relative w-full h-[50vh] min-h-[280px] max-h-[420px] overflow-hidden"
          aria-hidden
        >
          <Image
            src="/background-about-1920x1080.webp"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[var(--background)]/60" />
        </section>

        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 -mt-32 sm:-mt-40 relative z-10">
          <div className="prose prose-[var(--foreground)] max-w-2xl mx-auto">
            {/* Logo 100x100 */}
            <div className="flex items-center gap-4 mb-8">
              <div className="relative w-[100px] h-[100px] shrink-0 rounded-2xl overflow-hidden border border-[var(--border)] shadow-lg bg-[var(--card)]">
                <Image
                  src="/logo-adm-100.webp"
                  alt="ADM.UIUX"
                  width={100}
                  height={100}
                  className="object-contain p-1"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground m-0">
                Tentang
              </h1>
            </div>
            <div className="space-y-4 text-[var(--muted)] leading-relaxed">
              <p>
                ADM.UIUX membantumu menemukan, melihat preview, dan membeli HTML landing page siap pakai. Mau template gratis atau desain premium, jelajahi koleksi kami dan mulai dalam hitungan menit.
              </p>
              <p>
                Buat akun untuk menyimpan pembelian dan mengakses panel untuk mengelola kontenmu. Kami fokus pada kesederhanaan dan kualitas.
              </p>
              <div className="pt-6 border-t border-[var(--border)]">
                <h2 className="text-base font-semibold text-foreground mb-2">Tentang penulis</h2>
                <p>
                  Nama saya <strong className="text-foreground">Adam Mudianto</strong>. Saya software developer dengan pengalaman lebih dari 15 tahun. Membangun landing page template dan tools untuk memudahkan proyek web Anda.
                </p>
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Media sosial</h3>
                  <SocialLinks variant="stack" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
