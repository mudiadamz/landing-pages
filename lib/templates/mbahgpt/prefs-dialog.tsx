"use client";

/**
 * Preferences & memory.
 *
 * Two things live here, and they are the two that change how EVERY chat answers:
 * standing response instructions, and the list of remembered facts. Both are sent
 * as part of the system message on each turn, which is why they are one screen and
 * not two.
 *
 * What is deliberately NOT here: model and temperature. Those are set once, in the
 * server's environment, and the route ignores whatever a client sends for them.
 */

import { useEffect, useRef, useState } from "react";
import {
  addChatMemory,
  deleteChatMemory,
  getChatPrefs,
  listChatMemories,
  saveChatPrefs,
  updateChatMemory,
  type ChatMemoryRow,
} from "@/lib/actions/chat";

/**
 * The dialog is MOUNTED on open and unmounted on close, rather than staying
 * mounted and hiding itself. Two reasons, one each:
 *
 *   * The panel's state (instructions, memory list) is loaded on mount, so opening
 *     it always shows what is stored now — including memories the chat itself saved
 *     from a "remember this…" while the dialog was closed.
 *   * A `loading` flag can start out true instead of being switched on inside an
 *     effect, which would be a cascading render.
 */
export function PrefsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PrefsPanel onClose={onClose} />;
}

function PrefsPanel({ onClose }: { onClose: () => void }) {
  const [instructions, setInstructions] = useState("");
  const [memories, setMemories] = useState<ChatMemoryRow[]>([]);
  const [status, setStatus] = useState("");
  const [newMemory, setNewMemory] = useState("");
  const [loading, setLoading] = useState(true);
  const panel = useRef<HTMLDivElement>(null);

  // Two round trips, paid once, and only by the visitors who open this at all.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [prefs, stored] = await Promise.all([getChatPrefs(), listChatMemories()]);
      if (cancelled) return;
      setInstructions(prefs.responseInstructions);
      setMemories(stored);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const flash = (message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (!panel.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Preferensi dan memori"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-[var(--background)] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="m-0 text-sm font-semibold">Preferensi &amp; memori</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--muted)] transition-colors hover:text-foreground"
          >
            Tutup
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <h3 className="mt-0 mb-1.5 font-mono text-[0.72rem] tracking-[0.06em] text-[var(--muted)] uppercase">
            Instruksi jawaban
          </h3>
          <textarea
            value={instructions}
            disabled={loading}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="mis. Jawab ringkas. Utamakan poin. Selalu sertakan satuan."
            className="min-h-24 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const result = await saveChatPrefs(instructions);
                flash(result.error ?? "Tersimpan.");
              }}
              className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
            >
              Simpan
            </button>
            <span className="text-xs text-[var(--muted)]">{status}</span>
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Dikirim sebagai system message pada setiap permintaan, di semua chat.
          </p>

          <h3 className="mt-6 mb-1.5 font-mono text-[0.72rem] tracking-[0.06em] text-[var(--muted)] uppercase">
            Memori
          </h3>
          <div className="flex gap-2">
            <input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (!newMemory.trim()) return;
                setMemories(await addChatMemory(newMemory));
                setNewMemory("");
              }}
              placeholder="Tambahkan hal yang perlu diingat…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
            <button
              type="button"
              onClick={async () => {
                if (!newMemory.trim()) return;
                setMemories(await addChatMemory(newMemory));
                setNewMemory("");
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--primary)]"
            >
              Tambah
            </button>
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Tersimpan otomatis kalau pesan dibuka dengan <strong>remember…</strong>, <strong>note to self…</strong>,{" "}
            <strong>keep in mind…</strong>, <strong>don&apos;t forget…</strong>, atau{" "}
            <strong>for future reference…</strong>. Memori yang dipin selalu disertakan; sisanya dipilih berdasarkan
            kemiripan kata — jadi pin fakta yang harus selalu berlaku.
          </p>

          <div className="mt-3 space-y-1">
            {memories.length === 0 && !loading && (
              <p className="text-xs text-[var(--muted)]">Belum ada yang diingat.</p>
            )}
            {memories.map((memory) => (
              <div
                key={memory.id}
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
                  memory.pinned ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--accent-subtle)]/50"
                }`}
              >
                <div className="flex-1 text-sm [overflow-wrap:anywhere]">
                  {memory.text}
                  <span className="block text-[0.68rem] text-[var(--muted)]">
                    {new Date(memory.created_at).toLocaleString("id-ID")}
                  </span>
                </div>
                <button
                  type="button"
                  title={memory.pinned ? "Selalu disertakan — klik untuk melepas" : "Pin: selalu sertakan"}
                  aria-label={memory.pinned ? "Lepas pin" : "Pin memori"}
                  onClick={async () => setMemories(await updateChatMemory(memory.id, { pinned: !memory.pinned }))}
                  className={`rounded px-1 ${memory.pinned ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-foreground"}`}
                >
                  {memory.pinned ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  title="Lupakan ini"
                  aria-label={`Lupakan: ${memory.text}`}
                  onClick={async () => setMemories(await deleteChatMemory(memory.id))}
                  className="rounded px-1 text-[var(--muted)] transition-colors hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
