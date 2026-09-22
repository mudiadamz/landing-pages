import type { Metadata } from "next";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { createClient } from "@/lib/db/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { currentSite } from "@/lib/site-resolve";
import { TemplateHeader, TemplateFooter } from "@/lib/templates/chrome";
import { SocialLinks } from "@/components/social-links";
import { getSocialUrls, getSiteContent } from "@/lib/actions/site-settings";
import { ContactForm } from "@/components/contact-form";
import { SupportContactImages } from "@/components/support-contact-images";

export const metadata: Metadata = {
  title: "Kontak",
  description: "Form kontak dan media sosial untuk pertanyaan, masukan, atau kerja sama.",
};

export default async function ContactPage() {
  const t = translator(await requestLocale());
  const db = await createClient();
  const site = await currentSite();
  const [
    { data: { user } },
    categories,
    socialUrls,
    content,
  ] = await Promise.all([
    db.auth.getUser(),
    getCategories(site.business_id),
    getSocialUrls(),
    getSiteContent(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TemplateHeader user={user} categories={categories} />
      <main className="flex-1">
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-6">
              {content.contactHeading}
            </h1>
            <p className="text-[var(--muted)] leading-relaxed mb-6">
              {content.contactIntro}
            </p>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 mb-10">
              <h2 className="text-base font-semibold text-foreground mb-4">{t("contact.sendMessage")}</h2>
              <ContactForm />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-3">
              {content.supportContactHeading}
            </h2>
            <p className="text-sm text-[var(--muted)] mb-4">{content.supportContactIntro}</p>
            <SupportContactImages />
            <h2 className="text-base font-semibold text-foreground mb-3 mt-10">{t("panel.tabSocial")}</h2>
            <SocialLinks variant="stack" urls={socialUrls} label={t("home.socialLinks")} />
          </div>
        </section>
      </main>
      <TemplateFooter />
    </div>
  );
}
