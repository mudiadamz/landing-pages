import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { canSellProducts } from "@/lib/actions/profiles";
import { getLandingPageById } from "@/lib/actions/landing-pages";
import { getProductStats } from "@/lib/actions/product-stats";
import { getProductSummary, type Range } from "@/lib/actions/product-insights";
import { ProductStatsView } from "@/components/product-stats-view";
import { ProductSummaryCard } from "@/components/product-summary-card";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
};

const RANGES = [7, 30, 90];

export default async function ProductStatsPage({ params, searchParams }: Props) {
  const canSell = await canSellProducts();
  if (!canSell) redirect("/panel");

  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;

  const [page, stats, summary] = await Promise.all([
    getLandingPageById(id),
    getProductStats(id, days),
    getProductSummary(id, days as Range),
  ]);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/panel/products" className="text-sm text-[var(--muted)] transition-colors hover:text-foreground">
            ← Kembali
          </Link>
          <h1 className="truncate text-xl font-semibold tracking-tight">Statistik — {page.title}</h1>
        </div>
        {/* Range selector (full server navigation so the initial data is correct). */}
        <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/panel/product/${id}/stats?days=${r}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                days === r
                  ? "bg-[var(--card)] text-foreground shadow-sm ring-1 ring-[var(--border)]"
                  : "text-[var(--muted)] hover:text-foreground"
              }`}
            >
              {r} hari
            </Link>
          ))}
        </div>
      </div>

      {/* Behaviour-derived summary — interest/intent/conversion, grade, insights. */}
      {summary && <ProductSummaryCard s={summary} />}

      {/* Rendering + live polling happen client-side: each tick calls only the
          getProductStats action (not a full route refresh). Re-keyed on `days` so
          switching ranges reseeds the initial data. viewCountAllTime is the same
          lifetime counter shown in the product list, so the two reconcile. */}
      <ProductStatsView
        key={days}
        pageId={id}
        days={days}
        initial={stats}
        viewCountAllTime={(page as { view_count?: number }).view_count ?? 0}
      />
    </div>
  );
}
