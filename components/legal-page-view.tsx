import { createClient } from "@/lib/db/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { getLegalContent } from "@/lib/actions/site-settings";
import { TemplateHeader, TemplateFooter } from "@/lib/templates/chrome";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { currentSite } from "@/lib/site-resolve";
import { applySiteName, type LegalKey } from "@/lib/legal-config";

/**
 * The body of /privacy, /terms and /refund.
 *
 * One component, three routes. The routes stay separate files because their URLs
 * are fixed and linked from the footer, the sitemap and the checkout flow — but
 * the page was the same shell three times over, and copy that must not drift
 * between them (the "last updated" line, the container widths) had three places
 * to drift in.
 *
 * The prose is stored HTML, sanitised on write by updateLegalContent and rendered
 * inside `.page-prose` — the same pipeline as the editorial pages at /p/[slug].
 */
export async function LegalPageView({ pageKey }: { pageKey: LegalKey }) {
  const db = await createClient();
  const site = await currentSite();
  const [
    {
      data: { user },
    },
    categories,
    legal,
    locale,
  ] = await Promise.all([
    db.auth.getUser(),
    getCategories(site.business_id),
    getLegalContent(),
    requestLocale(),
  ]);
  const t = translator(locale);
  const raw = legal[pageKey];
  const page = {
    ...raw,
    title: applySiteName(raw.title, site.name),
    body: applySiteName(raw.body, site.name),
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TemplateHeader user={user} categories={categories} />
      <main className="flex-1">
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              {page.title}
            </h1>
            {/* Only shown once there has been an edit. Before that the honest
                answer is "we don't know", and printing today's date — which is
                what these pages did — is worse than printing nothing. */}
            {legal.updatedAt && (
              <p className="text-sm text-[var(--muted)]">
                {t("legal.lastUpdated", {
                  date: new Date(legal.updatedAt).toLocaleDateString(
                    locale === "en" ? "en-GB" : "id-ID",
                    { year: "numeric", month: "long", day: "numeric" },
                  ),
                })}
              </p>
            )}
            <div
              className="page-prose text-sm text-[var(--muted)]"
              dangerouslySetInnerHTML={{ __html: page.body }}
            />
          </div>
        </section>
      </main>
      <TemplateFooter />
    </div>
  );
}

/** Metadata for a legal route, from the same stored copy. */
export async function legalMetadata(pageKey: LegalKey) {
  const [legal, site] = await Promise.all([getLegalContent(), currentSite()]);
  const page = legal[pageKey];
  const body = applySiteName(page.body, site.name);
  const fallback = body
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 155);
  return {
    title: applySiteName(page.title, site.name),
    description: applySiteName(page.description, site.name).trim() || fallback,
  };
}
