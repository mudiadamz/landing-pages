import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi ADM.UIUX. Cara kami mengumpulkan, menggunakan, dan melindungi informasi Anda.",
};

export default async function PrivacyPage() {
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
              Kebijakan Privasi
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
            </p>
            <div className="space-y-4 text-[var(--muted)] leading-relaxed text-sm">
              <p>
                Privasi Anda penting bagi kami. Kebijakan ini menjelaskan cara kami mengumpulkan, menggunakan, dan melindungi informasi Anda saat menggunakan layanan kami.
              </p>
              <h2 className="text-foreground font-medium text-base pt-2">Informasi yang Kami Kumpulkan</h2>
              <p>
                Kami mengumpulkan informasi yang Anda berikan saat membuat akun, seperti email dan nama. Kami juga mengumpulkan data penggunaan untuk meningkatkan layanan kami.
              </p>
              <h2 className="text-foreground font-medium text-base pt-2">Cara Kami Menggunakan Informasi Anda</h2>
              <p>
                Kami menggunakan informasi Anda untuk menyediakan dan meningkatkan layanan, memproses transaksi, serta berkomunikasi terkait akun Anda.
              </p>
              <h2 className="text-foreground font-medium text-base pt-2">Keamanan Data</h2>
              <p>
                Kami menerapkan langkah-langkah keamanan yang sesuai untuk melindungi data pribadi Anda. Data disimpan dengan aman mengikuti praktik standar industri.
              </p>
              <p>
                Untuk pertanyaan terkait kebijakan ini, hubungi kami melalui link di halaman Kontak.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
