import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { TemplateHeader, TemplateFooter } from "@/lib/templates/chrome";
import { notFound } from "next/navigation";
import { getHiringContent } from "@/lib/actions/site-settings";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { HiringTestForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const hiring = await getHiringContent();
  return { title: hiring.testTitle, description: hiring.metaDescription };
}

export default async function HiringTestPage() {
  const db = await createClient();
  const [{ data: { user } }, categories, hiring, locale] = await Promise.all([
    db.auth.getUser(),
    getCategories(),
    getHiringContent(),
    requestLocale(),
  ]);
  const t = translator(locale);
  if (!hiring.enabled) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TemplateHeader user={user} categories={categories} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Link
          href="/hiring"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors mb-8 inline-block"
        >
          {t("hiring.backToAd")}
        </Link>

        <div className="space-y-4 mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{hiring.testTitle}</h1>
          <p className="text-[var(--muted)] text-sm sm:text-base leading-relaxed">
            {hiring.testIntro.replace("{count}", String(hiring.questions.length))}
          </p>
        </div>

        <HiringTestForm questions={hiring.questions} />
      </main>

      <TemplateFooter />
    </div>
  );
}
