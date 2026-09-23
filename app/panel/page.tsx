import Link from "next/link";
import Image from "next/image";
import { getProfile, requireFeature, canSellOnCurrentSite, currentSiteStanding } from "@/lib/actions/profiles";
import { getPurchasesForUser } from "@/lib/actions/purchases";
import { getMyFavorites } from "@/lib/actions/likes";
import { getMyProductStats, getStats } from "@/lib/actions/admin";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/**
 * The panel's front door.
 *
 * This used to be a bare redirect — sellers bounced to /panel/products, everyone
 * else to /panel/purchases — so the sidebar's "Dashboard" item never led
 * anywhere of its own and the URL you landed on was never the one you clicked.
 * Now it answers "where do I pick up?" for whoever is signed in, and GROWS a
 * section per role rather than swapping the page out: a publisher is still a
 * reader, and an admin is still both.
 */

const MAX_SHORTCUTS = 4;

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

const nf = (n: number) => n.toLocaleString("id-ID");

export default async function PanelPage() {
  const t = translator(await requestLocale());
  const profile = await getProfile();
  const seller = await canSellOnCurrentSite();

  // Publishers get their own-products view and never the site-wide one, matching
  // the split /panel/sales already enforces.
  // Staff melihat produknya sendiri, bukan angka seluruh situs — pembagian yang
  // sama dengan /panel/sales. Owner dan Platform melihat angka penuh.
  const standing = await currentSiteStanding();
  const wantsGlobal =
    (await requireFeature("stats")) && standing?.businessRole !== "staff";

  const [purchases, favorites, sellerStats, globalStats] = await Promise.all([
    getPurchasesForUser(),
    getMyFavorites(),
    seller ? getMyProductStats() : Promise.resolve(null),
    wantsGlobal ? getStats() : Promise.resolve(null),
  ]);

  const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0];
  const nothingYet =
    purchases.length === 0 && favorites.length === 0 && !sellerStats && !globalStats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {firstName ? t("panel.greeting", { name: firstName }) : t("panel.navDashboard")}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t("panel.dashIntro")}
        </p>
      </div>

      {/* ---- Everyone ---- */}
      <section className="grid gap-4 sm:grid-cols-2">
        <ShortcutCard
          href="/panel/purchases"
          label={t("panel.dashMyEbooks")}
          detail={purchases.length > 0 ? `${nf(purchases.length)} judul` : t("panel.noPurchasesYet")}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
        <ShortcutCard
          href="/panel/favorites"
          label={t("panel.navFavorites")}
          detail={favorites.length > 0 ? t("panel.productCount", { count: nf(favorites.length) }) : t("panel.noFavoritesYet")}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          }
        />
      </section>

      {purchases.length > 0 && (
        <section className="space-y-3">
          <SectionHead title={t("panel.dashKeepReading")} href="/panel/purchases" more={t("panel.dashAllEbooks")} />
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {purchases.slice(0, MAX_SHORTCUTS).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/read/${p.slug}`}
                  className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition-colors hover:border-[var(--primary)]"
                >
                  <div className="relative aspect-[3/4] w-full bg-[var(--background)]">
                    {p.thumbnail_url ? (
                      <Image
                        src={p.thumbnail_url}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center px-3 text-center text-xs text-[var(--muted)]">
                        {p.title}
                      </span>
                    )}
                  </div>
                  <span className="line-clamp-2 px-3 py-2 text-sm font-medium text-foreground">
                    {p.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {favorites.length > 0 && (
        <section className="space-y-3">
          <SectionHead title={t("panel.dashRecentFavorites")} href="/panel/favorites" more={t("panel.dashAllFavorites")} />
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
            {favorites.slice(0, MAX_SHORTCUTS).map((f) => {
              const price = f.price_discount || f.price || 0;
              return (
                <li key={f.id}>
                  <Link
                    href={`/preview/${f.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--background)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {f.title}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {f.is_free || price <= 0 ? t("common.free") : formatIDR(price)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---- Seller ---- */}
      {sellerStats && (
        <section className="space-y-3">
          <SectionHead title={t("panel.dashMySales")} href="/panel/sales" more={t("panel.dashSalesDetail")} />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t("analytics.product")} value={nf(sellerStats.totalProducts)} />
            <StatCard
              label={t("panel.dashSold")}
              value={
                <>
                  {nf(sellerStats.totalSales)}{" "}
                  {sellerStats.totalRevoked > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      ({nf(sellerStats.totalRevoked)})
                    </span>
                  )}
                </>
              }
            />
            <StatCard label={t("panel.dashRevenue")} value={formatIDR(sellerStats.totalRevenue)} />
          </div>
          {sellerStats.products.length > 0 && (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
              {sellerStats.products.slice(0, MAX_SHORTCUTS).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/panel/product/${p.id}/stats`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--background)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {p.title}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {nf(p.sold)}
                      {p.revoked > 0 && (
                        <span className="text-red-600 dark:text-red-400"> ({nf(p.revoked)})</span>
                      )}{" "}
                      {t("panel.soldSuffix")} {formatIDR(p.revenue)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---- Admin ---- */}
      {globalStats && (
        <section className="space-y-3">
          <SectionHead title={t("panel.navGroupSite")} href="/panel/sales" more={t("panel.dashFullStats")} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t("analytics.product")} value={nf(globalStats.totalLandingPages)} />
            <StatCard
              label={t("panel.dashPurchases")}
              value={
                <>
                  {nf(globalStats.totalPurchases)}{" "}
                  {globalStats.totalRevoked > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      ({nf(globalStats.totalRevoked)})
                    </span>
                  )}
                </>
              }
            />
            <StatCard
              label={t("panel.dashActiveAccess")}
              value={nf(globalStats.totalPurchases - globalStats.totalRevoked)}
            />
            <StatCard label={t("panel.dashBuyers")} value={nf(globalStats.totalCustomers)} />
          </div>
        </section>
      )}

      {/* A signed-in customer with nothing yet should get a way out, not four
          empty cards. */}
      {nothingYet && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm sm:p-12">
          <p className="text-sm text-[var(--muted)]">
            {t("panel.dashEmpty")}
          </p>
          <div className="mt-4 flex justify-center">
            <Link
              href="/"
              className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95"
            >
              {t("panel.dashBrowse")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({ title, href, more }: { title: string; href: string; more: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h2>
      <Link href={href} className="shrink-0 text-sm font-medium text-[var(--primary)] hover:underline">
        {more}
      </Link>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
    </div>
  );
}

function ShortcutCard({
  href,
  label,
  detail,
  icon,
}: {
  href: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors hover:border-[var(--primary)] sm:p-5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--primary)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-sm text-[var(--muted)]">{detail}</span>
      </span>
    </Link>
  );
}
