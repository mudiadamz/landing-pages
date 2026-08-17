import { redirect } from "next/navigation";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { Button } from "@/components/ui/button";
import { canSellProducts } from "@/lib/actions/profiles";
import { getLandingPagesForUser, getCategories } from "@/lib/actions/landing-pages";
import { ProductList } from "../product-list";
import { panelScope } from "@/lib/site-scope";
import { SiteScopeCoverage } from "@/components/site-scope-coverage";

export default async function PanelPage() {
  // Product management is seller-only; everyone else manages their purchases.
  const canSell = await canSellProducts();
  if (!canSell) redirect("/panel/purchases");

  return <SellerPanel />;
}

async function SellerPanel() {
  const t = translator(await requestLocale());
  const [pages, categories, scope] = await Promise.all([
    getLandingPagesForUser(),
    getCategories(),
    panelScope(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{t("panel.navProducts")}</h1>
        <Button
          size="md"
          href="/panel/product/new"
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
          className="gap-2 hover:opacity-90"
        >
          Buat baru
        </Button>
      </div>

      <SiteScopeCoverage
        host={scope.site.host}
        name={scope.site.name}
        siteCount={scope.siteCount}
        includesUnattributed={scope.includesUnattributed}
        what="products"
      />

      {pages.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">Belum ada produk digital.</p>
          <div className="mt-4 flex justify-center">
            <Button size="md" href="/panel/product/new" className="gap-2 hover:opacity-90">
              Buat produk baru
            </Button>
          </div>
        </div>
      ) : (
        <ProductList pages={pages} categories={categories} />
      )}
    </div>
  );
}
