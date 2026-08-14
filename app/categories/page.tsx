import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { currentSite } from "@/lib/site-resolve";
import { TemplateCategoriesView } from "@/lib/templates/chrome";
import { requestLocale } from "@/lib/i18n/request";

export const metadata: Metadata = {
  // No brand suffix: app/layout.tsx appends "| {site.name}" per domain, so a
  // hardcoded one both doubles up and names the wrong storefront.
  title: "Semua Kategori",
  description: "Jelajahi semua kategori dan sub-kategori produk digital.",
  alternates: { canonical: "/categories" },
};

/** Data loader; the storefront's template decides how the sections look. */
export default async function CategoriesPage() {
  const supabase = await createClient();
  const [{ data: { user } }, site, categories] = await Promise.all([
    supabase.auth.getUser(),
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
