"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * The steps this panel cannot do for you.
 *
 * Adding a row to lp_sites makes the app ready to serve a domain; it does not make
 * the domain reach the app, and it does not let anyone sign in on it. Those live in
 * Vercel and Supabase. Written per-domain with the real strings filled in, because
 * the failure mode is pasting a nearly-right URL and getting a redirect error with
 * no clue which of the three places is wrong.
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

function Value({ children }: { children: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-md bg-[var(--card)] px-2 py-1">
      <code className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] text-foreground">
        {children}
      </code>
      <Copy value={children} />
    </span>
  );
}

function Step({
  n,
  title,
  where,
  children,
}: {
  n: number;
  title: string;
  where?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[0.6875rem] font-semibold text-[var(--primary)]">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-foreground">
          {title}
          {where && <span className="ml-1.5 font-normal text-[var(--muted)]">· {where}</span>}
        </p>
        <div className="space-y-1.5 text-xs text-[var(--muted)]">{children}</div>
      </div>
    </li>
  );
}

export function DomainSetupGuide({
  host,
  supabaseProjectUrl,
  canonicalHost,
  vercelAutomated,
}: {
  host: string;
  supabaseProjectUrl: string;
  canonicalHost: string;
  /** A token is configured, so the panel adds the domain to Vercel itself. */
  vercelAutomated: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const isSubdomain = host.endsWith(`.${canonicalHost}`);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            {t("sites.guideHeading")}
          </span>
          <span className="block text-xs text-[var(--muted)]">
            {vercelAutomated
              ? t("sites.guideSubAuto", { host })
              : t("sites.guideSubManual", { host })}
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-[var(--primary)]">
          {open ? t("common.close") : t("sites.open")}
        </span>
      </button>

      {open && (
        <ol className="space-y-4 border-t border-[var(--border)] px-3 py-3">
          <Step
            n={1}
            title={
              vercelAutomated
                ? t("sites.step1TitleAuto")
                : t("sites.step1Title")
            }
            where="Vercel"
          >
            {vercelAutomated ? (
              <p>{t("sites.vercelAutoBody")}</p>
            ) : (
              <>
                <p>
                  {t("sites.vercelManualProject")}{" "}
                  <strong className="text-foreground">landing_pages</strong>{" "}
                  {t("sites.vercelManualPath")}{" "}
                  <strong className="text-foreground">Add</strong>
                  {t("sites.vercelManualThenEnter")}
                </p>
                <Value>{host}</Value>
              </>
            )}
            {isSubdomain ? (
              <p>
                {t("sites.subdomainOfBefore")}{" "}
                <span className="font-mono">{canonicalHost}</span>{" "}
                {t("sites.subdomainOfAfter")}
              </p>
            ) : (
              <p>{t("sites.separateDomainBody")}</p>
            )}
          </Step>

          <Step n={2} title={t("sites.step2Title")} where={t("sites.stepWhereAuto")}>
            <p>{t("sites.authLegacy", { host, canonical: canonicalHost })}</p>
            <p>
              {t("sites.authNowBefore", { host, canonical: canonicalHost })}{" "}
              <strong className="text-foreground">{t("sites.authNoExtraWork")}</strong>{" "}
              {t("sites.authNowAfter")}
            </p>
            <p>
              {t("sites.sessionBefore")}{" "}
              <strong className="text-foreground">{t("sites.sessionNot")}</strong>{" "}
              {t("sites.sessionAfter")}
            </p>
            <p>{t("sites.redirectUrlNote")}</p>
            <Value>{`https://${canonicalHost}/auth/callback`}</Value>
            <p>
              {t("sites.googleUrisBefore")} <em>Authorized redirect URIs</em>{" "}
              {t("sites.googleUrisAfter")}
            </p>
            <Value>{`${supabaseProjectUrl}/auth/v1/callback`}</Value>
          </Step>

          <Step n={3} title={t("sites.step3Title")} where={host}>
            <p>{t("sites.step3Intro")}</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>{t("sites.step3CheckHome")}</li>
              <li>{t("sites.step3CheckLogin")}</li>
              <li>
                <span className="font-mono">/panel/purchases</span>{" "}
                {t("sites.step3Purchases")}{" "}
                <span className="font-mono">{canonicalHost}</span>.
              </li>
            </ul>
            <p>
              {t("sites.paymentBefore")}{" "}
              <span className="font-mono">{canonicalHost}</span>
              {t("sites.paymentAfter")}
            </p>
          </Step>
        </ol>
      )}
    </div>
  );
}
