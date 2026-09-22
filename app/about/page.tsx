import type { Metadata } from "next";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import Image from "next/image";
import { createClient } from "@/lib/db/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { getSiteContent } from "@/lib/actions/site-settings";
import { TemplateHeader, TemplateFooter } from "@/lib/templates/chrome";
import { SupportContactImages } from "@/components/support-contact-images";

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await requestLocale());
  return { title: t("nav.about"), description: t("about.metaDescription") };
}

export default async function AboutPage() {
  const t = translator(await requestLocale());
  const db = await createClient();
  const [
    { data: { user } },
    categories,
    content,
  ] = await Promise.all([
    db.auth.getUser(),
    getCategories(),
    getSiteContent(),
  ]);
  const { founder } = content;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TemplateHeader user={user} categories={categories} />
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
                  src="/icon.svg"
                  alt="Storefront"
                  width={100}
                  height={100}
                  className="object-contain p-1"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground m-0">
                {content.aboutHeading}
              </h1>
            </div>
            <div className="space-y-4 text-[var(--muted)] leading-relaxed">
              {content.aboutParagraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
              {/* Only when an author is configured (/panel/content). Off by
                  default, so a fresh site shows no placeholder author. */}
              {founder.enabled && founder.name && (
                <div className="pt-6 border-t border-[var(--border)]">
                  <h2 className="text-base font-semibold text-foreground mb-3">{content.aboutAuthorHeading}</h2>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--card)]">
                      {/* The founder card, not a second copy of it: the photo, the
                          name and the sentence all come from /panel/content, so
                          this page cannot describe a different person than the
                          homepage does. */}
                      {founder.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={founder.photoUrl}
                          alt={founder.name}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>
                    <p className="flex-1 mt-0">
                      {t("about.myNameIs")} <strong className="text-foreground">{founder.name}</strong>
                      {founder.role ? ` — ${founder.role}.` : "."} {founder.bio}
                    </p>
                  </div>
                </div>
              )}
              <div className="pt-6 mt-6 border-t border-[var(--border)]">
                <h2 className="text-base font-semibold text-foreground mb-3">
                  {content.supportContactHeading}
                </h2>
                <p className="text-sm text-[var(--muted)] mb-4">{content.supportContactIntro}</p>
                <SupportContactImages />
              </div>
            </div>
          </div>
        </section>
      </main>
      <TemplateFooter />
    </div>
  );
}
