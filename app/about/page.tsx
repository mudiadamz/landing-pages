import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} />
      <main className="flex-1">
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="prose prose-[var(--foreground)] max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-6">
              Tentang
            </h1>
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
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
