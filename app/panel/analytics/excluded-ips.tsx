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
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">IP yang dikecualikan</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Kunjungan dari alamat ini tidak dihitung. Berguna saat kamu membuka situs
          sendiri <strong className="text-foreground">tanpa login</strong> — pengecualian
          per-user hanya jalan kalau kamu login. Menambahkan IP juga menghapus sesi lamanya.
        </p>
      </div>

      {myIp && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--background)] px-3 py-2">
          <span className="text-xs text-[var(--muted)]">IP kamu sekarang:</span>
          <code className="font-mono text-xs text-foreground">{myIp}</code>
          {alreadyMine ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              sudah dikecualikan
            </span>
          ) : (
            <button
              type="button"
              onClick={() => add(myIp, "IP saya")}
              disabled={pending}
              className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Kecualikan IP ini
            </button>
          )}
        </div>
      )}

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

      {msg && <p className="text-xs text-[var(--primary)]">{msg}</p>}

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
  );
}
