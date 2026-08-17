"use client";

/**
 * The session list, and the per-row actions behind one ⋮.
 *
 * A row of icons per session ate the room the TITLE needs, which is the only thing
 * on the row anybody reads. Double-clicking a title still renames it in place —
 * discoverable through the menu, fast through the shortcut.
 *
 * The menu is written by hand rather than borrowed from a component library, for
 * the same reason it was in the original: it has to close on an outside click, on
 * Escape, and when the list scrolls, and it must not swallow the action queued
 * behind it.
 */

import { useEffect, useRef, useState } from "react";
import type { ChatSessionRow } from "@/lib/actions/chat";

function timestamp(iso: string): string {
  // Local time, minute precision. Seconds on a chat list is noise, and the ISO
  // string the server sends is UTC.
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionList({
  sessions,
  activeId,
  runningIds,
  unread,
  onOpen,
  onRename,
  onDelete,
}: {
  sessions: ChatSessionRow[];
  activeId: string | null;
  /** Sessions with a reply streaming right now, from this browser or another. */
  runningIds: Set<string>;
  unread: Set<string>;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    // Capture phase: the row underneath must not also handle the click that
    // dismisses the menu.
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    container.current?.addEventListener("scroll", close);
    const node = container.current;
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
      node?.removeEventListener("scroll", close);
    };
  }, [menuFor]);

  if (!sessions.length) {
    return <p className="px-2 py-2.5 text-xs text-[var(--muted)]">Belum ada chat tersimpan.</p>;
  }

  return (
    <div ref={container} className="space-y-0.5 overflow-y-auto p-1.5">
      {sessions.map((session) => {
        const active = session.id === activeId;
        const running = session.streaming || runningIds.has(session.id);
        const isRenaming = renamingId === session.id;

        return (
          <div
            key={session.id}
            className={`group/row relative flex items-center gap-1.5 rounded-xl px-2.5 py-2 transition-colors ${
              active ? "bg-[var(--accent-subtle)] shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-[var(--accent-subtle)]/60"
            }`}
          >
            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <RenameField
                  initial={session.title}
                  onCommit={(title) => {
                    setRenamingId(null);
                    if (title && title !== session.title) onRename(session.id, title);
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(session.id)}
                  onDoubleClick={() => setRenamingId(session.id)}
                  className="block w-full text-left"
                >
                  <span className={`block truncate text-sm ${active ? "font-semibold" : ""}`}>
                    {session.title || "Tanpa judul"}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.64rem] text-[var(--muted)]">
                    {running ? "menjawab…" : `${session.messages} msg · ${timestamp(session.updated_at)}`}
                  </span>
                </button>
              )}
            </div>

            {/* A pulsing dot means a reply is being produced; a still one means it
                finished while you were reading a different chat. */}
            {(running || unread.has(session.id)) && (
              <span
                aria-hidden
                title={running ? "Sedang menjawab" : "Jawaban baru belum dibaca"}
                className={`h-2 w-2 shrink-0 rounded-full bg-[var(--primary)] ${running ? "animate-pulse" : ""}`}
              />
            )}

            <button
              type="button"
              aria-label="Tindakan chat"
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(menuFor === session.id ? null : session.id);
              }}
              className={`shrink-0 rounded px-1 text-[var(--muted)] transition-opacity hover:text-[var(--primary)] ${
                active || menuFor === session.id ? "opacity-75" : "opacity-0 group-hover/row:opacity-75"
              }`}
            >
              ⋮
            </button>

            {menuFor === session.id && (
              <div
                role="menu"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full right-1 z-20 mt-1 flex min-w-40 flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuFor(null);
                    setRenamingId(session.id);
                  }}
                  className="rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-subtle)]"
                >
                  Ubah judul
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuFor(null);
                    onDelete(session.id);
                  }}
                  className="rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition-colors hover:bg-[var(--accent-subtle)] dark:text-red-400"
                >
                  Hapus chat
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RenameField({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // Stopped from bubbling: Escape here means "cancel the rename", not
        // "close whatever is open above me".
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(value.trim());
        }
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => onCommit(value.trim())}
      className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-sm outline-none focus:border-[var(--primary)]"
    />
  );
}
