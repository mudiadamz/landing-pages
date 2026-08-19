import { redirect } from "next/navigation";
import Link from "next/link";
import { getSalesOverview, type SalesOverview, type RecentSale } from "@/lib/actions/sales";
import { getCustomers, type CustomerRow } from "@/lib/actions/admin";
import { CustomerPurchasesButton } from "./customer-purchases";
import { panelScope } from "@/lib/site-scope";
import { SiteScopeCoverage } from "@/components/site-scope-coverage";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

// A function rather than a const, because the tab title is a translated string
// and the locale is per-request. Nothing in /panel is prerendered.
export async function generateMetadata() {
  return { title: translator(await requestLocale())("panel.navSales") };
}

/**
 * Sales monitoring for admins and publishers.
 *
 * Was /panel/stats, and was mostly a customer directory: the admin view listed
 * who had bought but never said how much money came in, and neither view showed
 * a single transaction. Both are now here, and the page is organised around the
 * question it exists to answer — what sold, for how much, and to whom.
 *
 * Scope is decided in getSalesOverview(), not here: a publisher gets figures for
 * their own products only, and the customer directory (which carries the revoke
 * controls) stays admin-only.
 */

const nf = (n: number) => n.toLocaleString("id-ID");
const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SalesPage() {
  const t = translator(await requestLocale());
  const [data, scope] = await Promise.all([getSalesOverview(), panelScope()]);
  if (!data) redirect("/panel");

  // The customer directory is the admin's tool for withdrawing access, so it
  // only loads for the global view.
  const customers = data.scope === "global" ? await getCustomers() : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("panel.navSales")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {data.scope === "global" ? t("sales.scopeAll") : t("sales.scopeOwn")}
        </p>
      </div>

      <SiteScopeCoverage
        host={scope.site.host}
        name={scope.site.name}
        siteCount={scope.siteCount}
        includesUnattributed={scope.includesUnattributed}
        what="sales"
      />

      <Summary data={data} />

      <RecentSales rows={data.recent} />

      <PerProduct data={data} />

      {data.scope === "global" && <Customers customers={customers} />}
    </div>
  );
}

async function Summary({ data }: { data: SalesOverview }) {
  const t = translator(await requestLocale());
  return (
    <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      <Card
        label={t("panel.dashRevenue")}
        value={idr(data.revenueTotal)}
        sub={t("sales.last30", { value: idr(data.revenue30) })}
      />
      <Card
        label={t("panel.dashSold")}
        value={
          <>
            {nf(data.salesTotal)}
            {data.salesRevoked > 0 && (
              <span
                title={t("sales.revokedTitle", { count: data.salesRevoked })}
                className="text-red-600 dark:text-red-400"
              >
                {" "}({nf(data.salesRevoked)})
              </span>
            )}
          </>
        }
        sub={t("sales.last30", { value: nf(data.sales30) })}
      />
      <Card label={t("analytics.product")} value={nf(data.productCount)} />
      {data.scope === "global" ? (
        <Card label={t("panel.dashBuyers")} value={nf(data.buyerCount)} />
      ) : (
        <Card
          label={t("panel.dashActiveAccess")}
          value={nf(data.salesTotal - data.salesRevoked)}
          sub={t("panel.soldMinusRevoked")}
        />
      )}
    </section>
  );
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-foreground sm:text-2xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

/** The page's reason to exist: what actually happened, most recent first. */
async function RecentSales({ rows }: { rows: RecentSale[] }) {
  const t = translator(await requestLocale());
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {t("sales.recent")}
      </h2>

      {rows.length === 0 ? (
        <Empty>{t("sales.noTransactions")}</Empty>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 font-medium text-foreground">{r.productTitle}</p>
                  <p className="shrink-0 text-sm font-semibold text-foreground">{idr(r.amount)}</p>
                </div>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  {r.buyerName || r.buyerEmail || "—"}
                </p>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {formatDate(r.at)}
                  {r.method ? ` · ${r.method}` : ""}
                  {r.revoked && <RevokedTag />}
                </p>
              </li>
            ))}
          </ul>

          <Table
            head={[
              t("analytics.product"),
              t("panel.dashBuyers"),
              t("analytics.time"),
              t("panel.method"),
              t("sales.amount"),
            ]}
            align={["left", "left", "left", "left", "right"]}
          >
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--background)]/30"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {r.productTitle}
                  {r.revoked && <RevokedTag />}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">
                  {r.buyerName || r.buyerEmail || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{formatDate(r.at)}</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{r.method || "—"}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                  {idr(r.amount)}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </section>
  );
}

async function PerProduct({ data }: { data: SalesOverview }) {
  const t = translator(await requestLocale());
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {t("sales.perProduct")}
      </h2>

      {data.products.length === 0 ? (
        <Empty>{t("sales.noProducts")}</Empty>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {data.products.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="font-medium text-foreground">{p.title}</p>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {t("sales.soldCount", { count: nf(p.sold) })}
                  {p.revoked > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {" "}
                      ({t("sales.revokedCount", { count: nf(p.revoked) })})
                    </span>
                  )}{" "}
                  · {idr(p.revenue)}
                </p>
              </li>
            ))}
          </ul>

          <Table
            head={[
              t("analytics.product"),
              t("panel.dashSold"),
              t("sales.revoked"),
              t("panel.dashRevenue"),
            ]}
            align={["left", "right", "right", "right"]}
          >
            {data.products.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--background)]/30"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/panel/product/${p.id}/stats`} className="hover:text-[var(--primary)]">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-sm text-foreground">{nf(p.sold)}</td>
                <td className="px-4 py-3 text-right text-sm">
                  {p.revoked > 0 ? (
                    <span className="text-red-600 dark:text-red-400">{nf(p.revoked)}</span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-[var(--muted)]">
                  {idr(p.revenue)}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </section>
  );
}

async function Customers({ customers }: { customers: CustomerRow[] }) {
  const t = translator(await requestLocale());
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {t("sales.customers")}
      </h2>

      {customers.length === 0 ? (
        <Empty>{t("sales.noCustomers")}</Empty>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {customers.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="font-medium text-foreground">{c.full_name || "—"}</p>
                <p className="mt-0.5 break-all text-sm text-[var(--muted)]">{c.email || "—"}</p>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {t("sales.purchaseCount", { count: nf(c.purchase_count) })}
                  {c.revoked_count > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {" "}
                      ({t("sales.revokedCount", { count: nf(c.revoked_count) })})
                    </span>
                  )}{" "}
                  · {formatDate(c.last_purchase_at)}
                </p>
                <div className="mt-3">
                  <CustomerPurchasesButton
                    userId={c.id}
                    name={c.full_name || c.email || t("sales.customerFallback")}
                    count={c.purchase_count}
                  />
                </div>
              </li>
            ))}
          </ul>

          <Table
            head={[
              t("content.name"),
              t("sales.email"),
              t("panel.dashPurchases"),
              t("sales.last"),
              t("sales.access"),
            ]}
            align={["left", "left", "left", "left", "right"]}
          >
            {customers.map((c) => (
              <tr
                key={c.id}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--background)]/30"
              >
                <td className="px-4 py-3 font-medium text-foreground">{c.full_name || "—"}</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{c.email || "—"}</td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {nf(c.purchase_count)}
                  {c.revoked_count > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {" "}({nf(c.revoked_count)})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">
                  {formatDate(c.last_purchase_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <CustomerPurchasesButton
                    userId={c.id}
                    name={c.full_name || c.email || t("sales.customerFallback")}
                    count={c.purchase_count}
                  />
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </section>
  );
}

function Table({
  head,
  align,
  children,
}: {
  head: string[];
  align: ("left" | "right")[];
  children: React.ReactNode;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm sm:block">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-sm font-medium text-foreground ${
                    align[i] === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

async function RevokedTag() {
  const t = translator(await requestLocale());
  return (
    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6875rem] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      {t("sales.revokedTag")}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
      <p className="text-sm text-[var(--muted)]">{children}</p>
    </div>
  );
}
