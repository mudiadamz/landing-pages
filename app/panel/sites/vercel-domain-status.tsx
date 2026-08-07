"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getDomainStatus,
  attachDomainToVercel,
  recheckDomainVerification,
  type VercelStatus,
} from "@/lib/actions/sites";

const BOX =
  "space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5";

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
        <p className="text-xs text-[var(--muted)]">Memeriksa status di Vercel…</p>
      </div>
    );
  }
  // No token: the written guide is the only instruction, so add nothing here.
  if (status.kind === "not-configured") return null;

  function act(fn: () => Promise<VercelStatus>) {
    startTransition(async () => setStatus(await fn()));
  }

  const state = status.kind === "ok" ? status.state : null;
  const badge = !state
    ? { text: "Gagal diperiksa", cls: "bg-red-500/10 text-red-600 dark:text-red-400" }
    : !state.added
      ? { text: "Belum di Vercel", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" }
      : state.verified
        ? { text: "Aktif di Vercel", cls: "bg-green-500/10 text-green-700 dark:text-green-400" }
        : { text: "Menunggu DNS", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };

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
        {state?.added && !state.verified && (
          <button
            type="button"
            onClick={() => act(() => recheckDomainVerification(host))}
            disabled={pending}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)] disabled:opacity-60"
          >
            {pending ? "Memeriksa…" : "Cek verifikasi"}
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
      </div>

      {status.kind === "error" && <p className="text-xs text-red-500">{status.error}</p>}

      {state?.verified && (
        <p className="text-xs text-[var(--muted)]">
          Vercel sudah melayani domain ini, SSL otomatis. Tinggal langkah Supabase di bawah.
        </p>
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
