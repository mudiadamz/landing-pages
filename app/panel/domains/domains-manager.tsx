"use client";

import { useState, useTransition } from "react";
import {
  checkCustomDomain,
  removeCustomDomain,
  requestCustomDomain,
  warmCustomDomain,
  type DomainCheck,
  type DomainRow,
  type WarmResult,
} from "@/lib/actions/domains";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";

/**
 * "Bring your own domain", as two records and a button.
 *
 * The screen is built around the one thing that actually goes wrong: somebody
 * pastes a nearly-right value into their registrar and gets no feedback for
 * hours. So each record is shown as an exact, copyable triple — type, name,
 * value — and the check reports the two halves SEPARATELY. "Not working" when
 * one half is already right sends people to re-fix the half that was fine.
 */

function Copy({ value }: { value: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          setDone(false);
        }
      }}
      className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-foreground"
    >
      {done ? t("sites.copied") : t("sites.copy")}
    </button>
  );
}

function Record({ type, name, value }: { type: string; name: string; value: string }) {
  const t = useT();
  return (
    <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 sm:grid-cols-[4rem_minmax(0,1fr)]">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{type}</span>
      <div className="min-w-0 space-y-1.5">
        <div className="min-w-0">
          <p className="text-[0.6875rem] uppercase tracking-wider text-[var(--muted)]">
            {t("domains.recordName")}
          </p>
          <span className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{name}</code>
            <Copy value={name} />
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[0.6875rem] uppercase tracking-wider text-[var(--muted)]">
            {t("domains.recordValue")}
          </p>
          <span className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</code>
            <Copy value={value} />
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Certificate readiness, separate from the DNS chips above it.
 *
 * Its own indicator because it fails for its own reasons and is fixed in its
 * own place: DNS is something the owner changes at their registrar, a
 * certificate is something our edge either has or is getting. Folding them into
 * one "status" would tell somebody to re-check DNS that was already correct.
 */
function CertChip({ row, result }: { row: DomainRow; result?: WarmResult }) {
  const t = useT();
  const state = result?.state ?? (row.certReadyAt ? "ready" : row.certError ? "failed" : "elsewhere");
  const [label, tone] =
    state === "ready"
      ? [t("domains.certReady"), "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"]
      : state === "issuing"
        ? [t("domains.certIssuing"), "bg-blue-500/10 text-blue-600 dark:text-blue-400"]
        : state === "failed"
          ? [t("domains.certFailed"), "bg-red-500/10 text-red-600 dark:text-red-400"]
          : [t("domains.certElsewhere"), "bg-[var(--muted)]/10 text-[var(--muted)]"];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function StateChip({ verified, live }: { verified: boolean; live: boolean }) {
  const t = useT();
  const [label, tone] = live
    ? [t("domains.stateLive"), "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"]
    : verified
      ? [t("domains.stateVerified"), "bg-blue-500/10 text-blue-600 dark:text-blue-400"]
      : [t("domains.statePending"), "bg-amber-500/10 text-amber-600 dark:text-amber-400"];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function DomainsManager({ domains }: { domains: DomainRow[] }) {
  const t = useT();
  const router = useRouter();
  const [host, setHost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, DomainCheck>>({});
  const [warms, setWarms] = useState<Record<string, WarmResult>>({});
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestCustomDomain(host);
      if (!res.ok) setError(res.error ?? t("domains.addFailed"));
      else {
        setHost("");
        router.refresh();
      }
    });
  }

  function check(id: string) {
    startTransition(async () => {
      const res = await checkCustomDomain(id);
      setChecks((prev) => ({ ...prev, [id]: res }));
      router.refresh();
    });
  }

  /**
   * Get the certificate now, rather than when a customer turns up.
   *
   * The first HTTPS request for a host is what makes on-demand TLS issue one,
   * and it takes 10–30 seconds. Pressing this means the owner waits for that,
   * once, instead of the shop's first visitor waiting for it — and if it fails,
   * the person who can fix it is the one who sees the error.
   */
  function warm(id: string) {
    startTransition(async () => {
      const res = await warmCustomDomain(id);
      setWarms((prev) => ({ ...prev, [id]: res }));
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeCustomDomain(id);
      if (!res.ok) setError(res.error ?? t("domains.removeFailed"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <label htmlFor="new-domain" className="block text-sm font-medium text-foreground">
          {t("sites.addDomain")}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="new-domain"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="shop.mereksendiri.com"
            disabled={pending}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          />
          <button
            type="submit"
            disabled={pending || !host.trim()}
            className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
          >
            {t("common.add")}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">{t("domains.rootOrSubdomain")}</p>
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      </form>

      {domains.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted)]">
          {t("domains.empty")}
        </p>
      ) : (
        <ul className="space-y-4">
          {domains.map((d) => {
            const result = checks[d.id];
            const live = !!d.verifiedAt && (result?.cnameOk ?? d.active);
            return (
              <li key={d.id} className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-foreground">
                    {d.host}
                  </code>
                  <StateChip verified={!!d.verifiedAt} live={live} />
                  <CertChip row={d} result={warms[d.id]} />
                </div>

                {/* Both records stay visible after verification: a domain that
                    moves registrar needs them again, and hiding them makes the
                    panel useless at exactly the moment it is needed. */}
                {/* A for a root domain, CNAME for a subdomain — decided in
                    lib/custom-domain.ts, not here, so the panel and the docs
                    cannot drift into two different instructions. */}
                <div className="space-y-2">
                  <Record type={d.dns.type} name={d.dns.name} value={d.dns.value} />
                  <Record type="TXT" name={d.verificationHost} value={d.verificationValue} />
                </div>
                {d.dns.type === "A" && (
                  <p className="text-xs text-[var(--muted)]">{t("domains.apexNote")}</p>
                )}

                {result && (
                  <ul className="space-y-1 text-xs">
                    <li className={result.txtFound ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)]"}>
                      {result.txtFound ? "✓" : "○"} {t("domains.checkTxt")}
                    </li>
                    <li className={result.cnameOk ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)]"}>
                      {result.cnameOk ? "✓" : "○"} {t("domains.checkCname")}
                    </li>
                    {result.error && (
                      <li className="text-red-500 dark:text-red-400">{result.error}</li>
                    )}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => check(d.id)}
                    disabled={pending}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)] disabled:opacity-50"
                  >
                    {pending ? t("domains.checking") : t("domains.check")}
                  </button>
                  {/* Only once ownership is proven: the edge refuses an
                      unverified host anyway, and spending a Let's Encrypt
                      attempt to be told that is worse than not offering it. */}
                  {d.verifiedAt && (
                    <button
                      type="button"
                      onClick={() => warm(d.id)}
                      disabled={pending}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)] disabled:opacity-50"
                    >
                      {pending ? t("domains.warming") : t("domains.warm")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    disabled={pending}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:border-red-500 disabled:opacity-50"
                  >
                    {t("common.delete")}
                  </button>
                </div>

                {/* DNS is not instant and people re-press the button. Saying so
                    once is cheaper than the support message that follows. */}
                {warms[d.id]?.message && (
                  <p className="text-xs text-[var(--muted)]">{warms[d.id]!.message}</p>
                )}
                {!warms[d.id] && d.certError && (
                  <p className="text-xs text-red-500 dark:text-red-400">{d.certError}</p>
                )}
                {!d.verifiedAt && <p className="text-xs text-[var(--muted)]">{t("domains.propagationNote")}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
