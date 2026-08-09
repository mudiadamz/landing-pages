import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getAnalytics, type Range } from "@/lib/actions/analytics";
import { getProductSummaries } from "@/lib/actions/product-insights";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { ExcludedIps } from "./excluded-ips";
import { listExcludedIps, getMyIp } from "@/lib/actions/excluded-ips";
import { panelScope } from "@/lib/site-scope";
import { SiteScopeCoverage } from "@/components/site-scope-coverage";
import { PanelPageHeader } from "@/components/panel-page-header";

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

  const [data, products, excludedIps, myIp, scope] = await Promise.all([
    getAnalytics(range),
    getProductSummaries(range),
    listExcludedIps(),
    getMyIp(),
    panelScope(),
  ]);

  return (
    <div className="space-y-6">
      <PanelPageHeader
        backHref="/panel"
        title="Analytics"
        description="Sesi & perjalanan pengunjung."
        actions={
          <>
          {/* Popup trigger — sits inline with the range picker so the exclusion
              list costs no vertical space above the numbers. */}
          <ExcludedIps initial={excludedIps} myIp={myIp} />
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
          </>
        }
      />

      <SiteScopeCoverage
        host={scope.site.host}
        name={scope.site.name}
        siteCount={scope.siteCount}
        includesUnattributed={scope.includesUnattributed}
        what="kunjungan"
      />

      <AnalyticsDashboard data={data} products={products} />
    </div>
  );
}
