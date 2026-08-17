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
 *
 * It is also PORTALLED to the body and positioned from the button's own rect. As
 * an ordinary absolutely-positioned child it was clipped by the list's
 * `overflow-y-auto` — invisible exactly when the list was short, because then the
 * scroll box ends a few pixels under the last row and the menu opens into
 * nothing. The standalone app hit this too and solved it the same way.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n";
import type { ChatSessionRow } from "@/lib/actions/chat";

/** Two items and the padding around them. Used to decide which way to open. */
const MENU_WIDTH = 168;
const MENU_HEIGHT = 88;

function timestamp(iso: string, locale: Locale): string {
  // Local time, minute precision. Seconds on a chat list is noise, and the ISO
  // string the server sends is UTC. The month name follows the reader's language
  // — "17 Agu" and "17 Aug" are the same row in two languages.
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale === "en" ? "en-GB" : "id-ID", {
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
  const t = useT();
  const locale = useLocale();
  // Where the menu is, not just whether: fixed coordinates, computed from the ⋮
  // that opened it.
  const [menu, setMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onClick = (e: MouseEvent) => {
      // A click inside the menu is a choice, not a dismissal.
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    // Fixed coordinates go stale the moment anything moves, so anything that
    // moves closes it rather than leaving the menu pointing at the wrong row.
    const node = container.current;
    node?.addEventListener("scroll", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      node?.removeEventListener("scroll", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  /**
   * Anchor the menu under the ⋮, flipping above it when the viewport runs out.
   *
   * The height is a constant rather than a measurement: the menu always has the
   * same two items, and measuring would mean rendering it once in the wrong place
   * to find out where the right place is.
   */
  const openMenu = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    const r = event.currentTarget.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setMenu({
      id,
      left: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      top: below < MENU_HEIGHT ? Math.max(8, r.top - MENU_HEIGHT) : r.bottom + 4,
    });
  };

  if (!sessions.length) {
    return <p className="px-2 py-2.5 text-xs text-[var(--muted)]">{t("chat.noSessions")}</p>;
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
                    {session.title || t("chat.untitled")}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.64rem] text-[var(--muted)]">
                    {running
                      ? t("chat.answering")
                      : t("chat.sessionMeta", {
                          count: session.messages,
                          when: timestamp(session.updated_at, locale),
                        })}
                  </span>
                </button>
              )}
            </div>

            {/* A pulsing dot means a reply is being produced; a still one means it
                finished while you were reading a different chat. */}
            {(running || unread.has(session.id)) && (
              <span
                aria-hidden
                title={running ? t("chat.answeringTitle") : t("chat.unreadTitle")}
                className={`h-2 w-2 shrink-0 rounded-full bg-[var(--primary)] ${running ? "animate-pulse" : ""}`}
              />
            )}

            <button
              type="button"
              aria-label={t("chat.rowActions")}
              onClick={(e) => {
                e.stopPropagation();
                if (menu?.id === session.id) setMenu(null);
                else openMenu(e, session.id);
              }}
              className={`shrink-0 rounded px-1 text-[var(--muted)] transition-opacity hover:text-[var(--primary)] ${
                active || menu?.id === session.id ? "opacity-75" : "opacity-0 group-hover/row:opacity-75"
              }`}
            >
              ⋮
            </button>

            {menu?.id === session.id &&
              createPortal(
                <div
                  ref={menuRef}
                  role="menu"
                  style={{ position: "fixed", left: menu.left, top: menu.top, width: MENU_WIDTH }}
                  className="z-50 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      setRenamingId(session.id);
                    }}
                    className="rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-subtle)]"
                  >
                    {t("chat.rename")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      onDelete(session.id);
                    }}
                    className="rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition-colors hover:bg-[var(--accent-subtle)] dark:text-red-400"
                  >
                    {t("chat.deleteChat")}
                  </button>
                </div>,
                document.body,
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
