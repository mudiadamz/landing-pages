import { translator, type MessageKey } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/**
 * Says out loud what the numbers on this screen cover.
 *
 * Necessary because `site_id` was added to the event and purchase tables long after they
 * started filling up, and attribution cannot be back-filled — nothing recorded which of
 * our domains a visit or a payment landed on. So:
 *
 *   canonical site → its own rows PLUS every unattributed one (that is where they came
 *                    from: this deployment served one domain for that whole period)
 *   niche site     → its own rows only, which means it reads ZERO until new data
 *                    arrives under it
 *
 * That zero is the reason this component exists. An empty sales screen for a domain that
 * demonstrably has traffic looks exactly like a broken query, and a silent one would send
 * someone hunting a bug that is really a start date.
 */

/**
 * What the screen counts, as a thing rather than a word.
 *
 * Callers used to pass the Indonesian noun ("penjualan") straight in, which made the
 * sentence untranslatable from four different files. The word now lives in the
 * dictionary, and the screen only has to say which of them it is.
 */
export type ScopeWhat = "sales" | "products" | "visits" | "messages";

const WHAT_KEY: Record<ScopeWhat, MessageKey> = {
  sales: "scope.whatSales",
  products: "scope.whatProducts",
  visits: "scope.whatVisits",
  messages: "scope.whatMessages",
};

export async function SiteScopeCoverage({
  host,
  name,
  siteCount,
  includesUnattributed,
  what,
}: {
  host: string;
  name: string;
  siteCount: number;
  /** True on the canonical site, where pre-attribution rows are counted in. */
  includesUnattributed: boolean;
  what: ScopeWhat;
}) {
  if (siteCount < 2) return null;

  const t = translator(await requestLocale());
  const noun = t(WHAT_KEY[what]);

  return (
    <p className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
      {t("scope.onlyFrom", { what: noun })}{" "}
      <strong className="font-medium text-foreground">{name}</strong>{" "}
      {/* Tidak lagi menunjuk sidebar: kontrolnya sekarang <PanelSiteFilter /> di
          atas halaman ini, dan petunjuk yang menunjuk tempat yang salah lebih
          buruk daripada tidak ada petunjuk. */}
      <span className="font-mono text-foreground">{host}</span>.{" "}
      {includesUnattributed
        ? t("scope.legacyIncluded")
        : t("scope.startsAtZero", { what: noun })}
    </p>
  );
}
