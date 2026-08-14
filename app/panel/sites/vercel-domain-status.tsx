"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getDomainStatus,
  attachDomainToVercel,
  recheckDomainVerification,
  detachDomainFromVercel,
  type VercelStatus,
} from "@/lib/actions/sites";
import { useT } from "@/lib/i18n/client";

const BOX =
  "space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5";

/** One DNS record laid out the way a registrar's form asks for it. */
function Record({ label, rows }: { label: string; rows: [string, string][] }) {
  return (
    <div className="space-y-1 rounded-lg bg-[var(--card)] p-2">
      <p className="text-[11px] font-medium text-foreground">{label}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <dt className="w-24 shrink-0 text-[11px] text-[var(--muted)]">{k}</dt>
            <dd className="flex min-w-0 flex-1 items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                {v}
              </code>
              <CopyValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
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
      className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)] transition-colors hover:text-foreground"
    >
      {done ? "✓" : "Copy"}
    </button>
  );
}

/**
 * Live state of one domain on the Vercel project, with the two buttons that move
 * it forward: attach it, and re-check DNS once the record exists.
 *
 * Read on mount rather than server-rendered with the page: it is a network call to
 * another provider, one per domain, and a slow or rate-limited Vercel must not hold
 * up the whole settings screen. Renders nothing at all when no token is configured,
 * so the written instructions stay the single source of truth in that case.
 */
export function VercelDomainStatus({ host }: { host: string }) {
  const t = useT();
  const [status, setStatus] = useState<VercelStatus | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getDomainStatus(host).then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [host]);

  if (!status) {
    return (
      <div className={BOX}>
        <p className="text-xs text-[var(--muted)]">{t("sites.checkingVercel")}</p>
      </div>
    );
  }
  // No token: the written guide is the only instruction, so add nothing here.
  if (status.kind === "not-configured") return null;

  function act(fn: () => Promise<VercelStatus>) {
    startTransition(async () => setStatus(await fn()));
  }

  const state = status.kind === "ok" ? status.state : null;
  const AMBER = "bg-amber-500/10 text-amber-600 dark:text-amber-400";

  // "On the project" and "reachable" are different facts. A domain can be verified
  // (nobody else's Vercel account holds it) and still answer nothing, because its
  // DNS never pointed here. Only both together earn the green badge.
  const badge = !state
    ? { text: "Gagal diperiksa", cls: "bg-red-500/10 text-red-600 dark:text-red-400" }
    : !state.added
      ? { text: "Belum di Vercel", cls: AMBER }
      : !state.verified
        ? { text: "Menunggu verifikasi kepemilikan", cls: AMBER }
        : state.dns?.misconfigured
          ? { text: "DNS belum diarahkan", cls: AMBER }
          : { text: "Aktif di Vercel", cls: "bg-green-500/10 text-green-700 dark:text-green-400" };

  const needsDns = !!state?.added && !!state.verified && !!state.dns?.misconfigured;
  // Apex vs subdomain decides A-record or CNAME. Two labels = apex; good enough here,
  // and both records are shown anyway so a multi-part TLD can't mislead anyone.
  const isApex = host.split(".").length === 2;

  return (
    <div className={BOX}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
          {badge.text}
        </span>
        {state && !state.added && (
          <button
            type="button"
            onClick={() => act(() => attachDomainToVercel(host))}
            disabled={pending}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)] disabled:opacity-60"
          >
            {pending ? "Menambahkan…" : "Tambah ke Vercel"}
          </button>
        )}
        {state?.added && (!state.verified || state.dns?.misconfigured) && (
          <button
            type="button"
            onClick={() =>
              act(() =>
                state.verified ? getDomainStatus(host) : recheckDomainVerification(host),
              )
            }
            disabled={pending}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)] disabled:opacity-60"
          >
            {pending ? "Memeriksa…" : state.verified ? "Cek DNS lagi" : "Cek verifikasi"}
          </button>
        )}
        {status.kind === "error" && (
          <button
            type="button"
            onClick={() => act(() => getDomainStatus(host))}
            disabled={pending}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)] disabled:opacity-60"
          >
            Coba lagi
          </button>
        )}
        {state?.added && (
          <button
            type="button"
            onClick={() => {
              if (
                !confirm(
                  `Lepas ${host} dari project Vercel?\n\nDomainnya langsung berhenti melayani situs ini. Pengaturan domain di panel TIDAK dihapus — bisa dipasang lagi kapan saja dengan "Tambah ke Vercel".`,
                )
              )
                return;
              act(() => detachDomainFromVercel(host));
            }}
            disabled={pending}
            className="ml-auto rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-red-600 disabled:opacity-60 dark:hover:text-red-400"
          >
            Lepas dari Vercel
          </button>
        )}
      </div>

      {status.kind === "error" && <p className="text-xs text-red-500">{status.error}</p>}

      {state?.verified && !state.dns?.misconfigured && (
        <p className="text-xs text-[var(--muted)]">
          Vercel sudah melayani domain ini, SSL otomatis. Tinggal langkah Supabase di bawah.
        </p>
      )}

      {/* The records the registrar needs. Values come from Vercel per project —
          the CNAME target is not a fixed string, so it must never be hardcoded. */}
      {needsDns && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Domain sudah terdaftar di Vercel tapi{" "}
            <strong>
              {state.dns?.configuredBy === null
                ? "DNS-nya belum mengarah ke sini"
                : "DNS-nya belum benar"}
            </strong>
            . Tambahkan record di{" "}
            <strong>tempat nameserver domain ini menunjuk</strong> — bukan selalu di
            registrar. Cek dulu nameserver-nya kalau tidak yakin.
          </p>

          {isApex && state.dns!.ipv4.length > 0 && (
            <Record
              label={t("sites.apexHint")}
              rows={[
                ["Type", "A"],
                ["Host / Name", "@"],
                ["Value", state.dns!.ipv4[0]],
              ]}
            />
          )}

          {!isApex && state.dns!.cname && (
            <Record
              label={t("sites.subdomainHint")}
              rows={[
                ["Type", "CNAME"],
                ["Host / Name", host.split(".")[0]],
                ["Value", state.dns!.cname],
              ]}
            />
          )}

          {/* Shown as the alternative, and as the fallback when the preferred record
              for this shape didn't come back. */}
          {isApex && state.dns!.cname && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--muted)]">
                Alternatif: arahkan nameserver ke Vercel
              </summary>
              <p className="mt-1.5 text-[var(--muted)]">
                Ganti nameserver domain ke Vercel di registrar — Vercel yang mengurus DNS,
                jadi tidak perlu A record. Nilai nameserver-nya ada di Vercel → Settings →
                Domains → domain ini. Catatan: semua DNS record lain (email, dll) harus
                dipindah ke Vercel juga.
              </p>
            </details>
          )}

          <p className="text-xs text-[var(--muted)]">
            Setelah record dipasang, klik <strong className="text-foreground">Cek DNS lagi</strong>.
            Propagasi DNS bisa beberapa menit sampai beberapa jam.
          </p>
        </div>
      )}

      {/* The DNS challenge, when Vercel can't verify on its own — i.e. a domain whose
          nameservers are elsewhere. Subdomains of a domain already on the account
          skip this entirely. */}
      {state?.added && !state.verified && (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--muted)]">
            {state.challenges.length > 0
              ? "Pasang salah satu record ini di registrar domain, lalu klik “Cek verifikasi”:"
              : "Vercel belum bisa memverifikasi. Cek panel Domains di Vercel untuk record yang diminta."}
          </p>
          {state.challenges.map((c, i) => (
            <div
              key={`${c.type}-${c.domain}-${i}`}
              className="space-y-1 rounded-lg bg-[var(--card)] px-2.5 py-2 text-[11px]"
            >
              <p className="font-medium text-foreground">
                {c.type} · {c.domain}
              </p>
              <p className="break-all font-mono text-[var(--muted)]">{c.value}</p>
              {c.reason && <p className="text-[var(--muted)]">{c.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
