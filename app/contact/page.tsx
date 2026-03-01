import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SocialLinks } from "@/components/social-links";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Kontak",
  description: "Hubungi ADM.UIUX. Form kontak dan media sosial untuk pertanyaan, masukan, atau kerja sama.",
};

export default async function ContactPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} />
      <main className="flex-1">
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-6">
              Kontak
            </h1>
            <p className="text-[var(--muted)] leading-relaxed mb-6">
              Ada pertanyaan atau masukan? Isi form di bawah atau hubungi lewat media sosial.
            </p>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 mb-10">
              <h2 className="text-base font-semibold text-foreground mb-4">Kirim pesan</h2>
              <ContactForm />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-3">Media sosial</h2>
            <SocialLinks variant="stack" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
