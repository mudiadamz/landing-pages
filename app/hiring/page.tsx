import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { notFound } from "next/navigation";
import { getHiringContent } from "@/lib/actions/site-settings";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { getCategories } from "@/lib/actions/landing-pages";
import { TemplateHeader, TemplateFooter } from "@/lib/templates/chrome";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const hiring = await getHiringContent();
  return { title: hiring.metaTitle, description: hiring.metaDescription };
}

/**
 * The job ad. Copy and the test questions are per-site data edited at
 * /panel/hiring; this route pins the URL and the layout.
 */
export default async function HiringPage() {
  const db = await createClient();
  const [{ data: { user } }, categories, hiring, locale] = await Promise.all([
    db.auth.getUser(),
    getCategories(),
    getHiringContent(),
    requestLocale(),
  ]);
  const t = translator(locale);
  // A storefront that is not recruiting should not be advertising a vacancy.
  if (!hiring.enabled) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TemplateHeader user={user} categories={categories} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors mb-8 inline-block"
        >
          {t("checkout.backHome")}
        </Link>

        <div className="space-y-10">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-xs font-medium text-[var(--primary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
              {hiring.badge}
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{hiring.title}</h1>
            <p className="text-[var(--muted)] text-base sm:text-lg leading-relaxed">{hiring.intro}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8 space-y-6">
            <div className="flex flex-wrap gap-3">
              {hiring.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-subtle)] text-foreground border border-[var(--border)]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">{hiring.scopeHeading}</h2>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{hiring.scopeBody}</p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">
                {hiring.requirementsHeading}
              </h2>
              <ul className="space-y-2.5">
                {hiring.requirements.map((req, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--muted)]">
                    <svg className="w-5 h-5 shrink-0 text-[var(--primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">
                {hiring.benefitsHeading}
              </h2>
              <ul className="space-y-2.5">
                {hiring.benefits.map((b, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--muted)]">
                    <svg className="w-5 h-5 shrink-0 text-[var(--accent-cool)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-5 sm:p-8 text-center space-y-4">
            <h2 className="text-base font-semibold text-foreground">{hiring.ctaHeading}</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed max-w-md mx-auto">
              {hiring.ctaBody.replace("{count}", String(hiring.questions.length))}
            </p>
            <Button
              size="md"
              href="/hiring/test"
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              className="rounded-xl px-5 py-3 text-sm gap-2 hover:opacity-95"
            >
              {hiring.ctaButton}
            </Button>
          </div>
        </div>
      </main>

      <TemplateFooter />
    </div>
  );
}
