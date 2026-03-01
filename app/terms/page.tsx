import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Ketentuan Layanan",
  description:
    "Ketentuan layanan ADM.UIUX. Syarat dan ketentuan penggunaan landing page template.",
};

export default async function TermsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} />
      <main className="flex-1">
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Ketentuan Layanan
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
            </p>
            <div className="space-y-4 text-[var(--muted)] leading-relaxed text-sm">
              <p>
                Dengan menggunakan layanan kami, Anda setuju dengan ketentuan ini. Mohon baca dengan saksama.
              </p>
              <h2 className="text-foreground font-medium text-base pt-2">Penggunaan Layanan</h2>
              <p>
                Anda setuju menggunakan platform landing page kami sesuai ketentuan ini dan hukum yang berlaku. Anda bertanggung jawab atas konten yang dibuat dan dibagikan.
              </p>
              <h2 className="text-foreground font-medium text-base pt-2">Akun</h2>
              <p>
                Anda wajib memberikan informasi yang akurat saat membuat akun. Anda bertanggung jawab menjaga keamanan kredensial Anda.
              </p>
              <h2 className="text-foreground font-medium text-base pt-2">Pembelian</h2>
              <p>
                Pembelian landing page berbayar mengikuti ketentuan penjual. Pengembalian dana dan dukungan diatur menurut kebijakan kami.
              </p>
              <h2 className="text-foreground font-medium text-base pt-2">Perubahan</h2>
              <p>
                Kami dapat memperbarui ketentuan ini sewaktu-waktu. Penggunaan layanan setelah perubahan berarti Anda menerima ketentuan terbaru.
              </p>
              <p>
                Untuk pertanyaan terkait ketentuan ini, hubungi kami melalui link di halaman Kontak.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
