import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getAnalytics, type Range } from "@/lib/actions/analytics";
import { getProductSummaries } from "@/lib/actions/product-insights";
import { AnalyticsDashboard } from "./analytics-dashboard";

export const metadata = { title: "Analytics" };

const RANGES: Range[] = [7, 30, 90];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  if (!(await requireAdmin())) redirect("/panel");

  const sp = await searchParams;
  const parsed = Number(sp.range) as Range;
  const range: Range = RANGES.includes(parsed) ? parsed : 30;

  const [data, products] = await Promise.all([getAnalytics(range), getProductSummaries(range)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/panel" className="text-sm text-[var(--muted)] transition-colors hover:text-foreground">
            ← Kembali
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <span className="w-fit rounded bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted)]">
            sesi &amp; perjalanan pengunjung
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/panel/analytics?range=${r}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                r === range
                  ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
                  : "text-[var(--muted)] hover:text-foreground"
              }`}
            >
              {r} hari
            </Link>
          ))}
        </div>
      </div>

      <AnalyticsDashboard data={data} products={products} />
    </div>
  );
}
