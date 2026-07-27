"use client";

import { useState, useTransition } from "react";
import {
  addExcludedIp,
  removeExcludedIp,
  purgeExcludedIp,
  type ExcludedIp,
} from "@/lib/actions/excluded-ips";

/**
 * Manage which addresses are kept out of the analytics. The per-user flag only
 * works for signed-in visitors, so this is what catches the owner's own
 * logged-out browsing.
 */
export function ExcludedIps({ initial, myIp }: { initial: ExcludedIp[]; myIp: string | null }) {
  const [rows, setRows] = useState<ExcludedIp[]>(initial);
  const [ip, setIp] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [open, setOpen] = useState(false);
  const alreadyMine = !!myIp && rows.some((r) => r.ip === myIp);

  function add(value: string, label?: string) {
    const v = value.trim();
    if (!v) return;
    start(async () => {
      const res = await addExcludedIp(v, label);
      if (!res.ok) {
        setMsg(res.error ?? "Gagal.");
        return;
      }
      setRows((prev) => [
        { ip: v, note: label?.trim() || null, created_at: new Date().toISOString(), sessions: 0 },
        ...prev.filter((r) => r.ip !== v),
      ]);
      setIp("");
      setNote("");
      setMsg(
        res.purged
          ? `${v} dikecualikan — ${res.purged} sesi lama ikut dihapus.`
          : `${v} dikecualikan.`,
      );
    });
  }

  function remove(value: string) {
    start(async () => {
      const res = await removeExcludedIp(value);
      if (!res.ok) {
        setMsg(res.error ?? "Gagal.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.ip !== value));
      setMsg(`${value} dihitung lagi.`);
    });
  }

  function purge(value: string) {
    start(async () => {
      const res = await purgeExcludedIp(value);
      setRows((prev) => prev.map((r) => (r.ip === value ? { ...r, sessions: 0 } : r)));
      setMsg(res.purged ? `${res.purged} sesi dari ${value} dihapus.` : "Tidak ada sesi tersisa.");
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      {/* Collapsed: one line. The list is set-and-forget, so it shouldn't sit
          above the numbers taking up room. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 font-medium text-foreground"
          aria-expanded={open}
        >
          <span className={`transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
            ›
          </span>
          IP dikecualikan
          <span className="rounded bg-[var(--background)] px-1.5 py-0.5 tabular-nums text-[var(--muted)]">
            {rows.length}
          </span>
        </button>

        {myIp && !alreadyMine && (
          <button
            type="button"
            onClick={() => add(myIp, "IP saya")}
            disabled={pending}
            className="rounded-lg bg-[var(--primary)] px-2 py-1 font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Kecualikan IP saya ({myIp})
          </button>
        )}
        {myIp && alreadyMine && (
          <span className="text-[var(--muted)]">
            IP kamu <code className="font-mono">{myIp}</code> sudah dikecualikan
          </span>
        )}
        {msg && <span className="text-[var(--primary)]">{msg}</span>}
      </div>

      {open && (
        <div className="space-y-3 border-t border-[var(--border)] px-3 py-3">
          <p className="text-xs text-[var(--muted)]">
            Kunjungan dari alamat ini tidak dihitung — berguna saat kamu membuka situs
            sendiri <strong className="text-foreground">tanpa login</strong>. Menambahkan IP
            juga menghapus sesi lamanya.
          </p>

      <div className="flex flex-wrap gap-2">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="mis. 103.12.34.56"
          className="min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="min-w-[8rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        />
        <button
          type="button"
          onClick={() => add(ip, note)}
          disabled={pending || !ip.trim()}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--background)] disabled:opacity-50"
        >
          Tambah
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Belum ada IP yang dikecualikan.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={r.ip} className="flex flex-wrap items-center gap-2 py-2">
              <code className="font-mono text-xs text-foreground">{r.ip}</code>
              {r.note && <span className="text-xs text-[var(--muted)]">· {r.note}</span>}
              {r.sessions > 0 && (
                <button
                  type="button"
                  onClick={() => purge(r.ip)}
                  disabled={pending}
                  className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/25 disabled:opacity-50 dark:text-amber-400"
                  title="Sesi lama masih ada — klik untuk hapus"
                >
                  {r.sessions} sesi lama · hapus
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(r.ip)}
                disabled={pending}
                className="ml-auto text-xs font-medium text-[var(--muted)] transition-colors hover:text-red-600 disabled:opacity-50"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
        </div>
      )}
    </div>
  );
}
