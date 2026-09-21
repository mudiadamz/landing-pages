import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { currentSite } from "@/lib/site-resolve";
import { TemplateCategoriesView } from "@/lib/templates/chrome";
import { requestLocale } from "@/lib/i18n/request";
import { translator } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await requestLocale());
  return {
    // No brand suffix: app/layout.tsx appends "| {site.name}" per domain, so a
    // hardcoded one both doubles up and names the wrong storefront.
    title: t("home.allCategories"),
    description: t("home.allCategoriesMeta"),
    alternates: { canonical: "/categories" },
  };
}

/** Data loader; the storefront's template decides how the sections look. */
export default async function CategoriesPage() {
  const db = await createClient();
  const [{ data: { user } }, site, categories] = await Promise.all([
    db.auth.getUser(),
    currentSite(),
    getCategories(),
  ]);

  return (
    <TemplateCategoriesView
      site={site}
      categories={categories}
      user={user}
      locale={await requestLocale()}
    />
  );
}
