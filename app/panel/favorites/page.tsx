import Link from "next/link";
import Image from "next/image";
import { getMyFavorites } from "@/lib/actions/likes";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function FavoritesPage() {
  const t = translator(await requestLocale());
  const favorites = await getMyFavorites();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Favorit</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("panel.favoritesIntro")}</p>
      </div>

      {favorites.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">
            {t("panel.noFavorites")}
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
      ) : (
        <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm divide-y divide-[var(--border)]">
          {favorites.map((p) => {
            const isFree = p.is_free === true;
            const price = p.price ?? 0;
            const discount = p.price_discount ?? 0;
            const hasDiscount = !isFree && discount > 0;
            const display = hasDiscount ? discount : price;
            const showAsFree = isFree || display <= 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/checkout/${p.slug}`}
                  className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--background)] sm:px-4"
                >
                  <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
                    {p.thumbnail_url ? (
                      <Image src={p.thumbnail_url} alt={p.title} fill sizes="80px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-[var(--muted)]">
                        {p.title}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-[var(--primary)]">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-sm">
                      {showAsFree ? (
                        <span className="font-semibold text-[var(--primary)]">{t("common.free")}</span>
                      ) : (
                        <>
                          {hasDiscount && price > 0 && (
                            <span className="text-xs text-[var(--muted)] line-through">{formatPrice(price)}</span>
                          )}
                          <span className="ml-2 font-semibold text-foreground">{formatPrice(display)}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
