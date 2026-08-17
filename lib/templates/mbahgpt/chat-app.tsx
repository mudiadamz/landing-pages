"use client";

/**
 * The chat, whole: session list, transcript, composer.
 *
 * Layout follows the original's split pane — the list is pinned from `md` up and a
 * drawer below it — but there is no toolbar above the transcript. The conversation
 * gets the whole column; the chat's name sits in a slim line that scrolls with it.
 *
 * (The standalone app put the chat name in the BROWSER TAB title, which was right
 * for a single-purpose local tool. Here the tab belongs to the storefront, so
 * rewriting it would mean a visitor's open tab stopped naming the site they are on.)
 *
 * This component fetches its own data through Server Actions, which is not a
 * violation of "presentation does not fetch" (docs/architecture.md §2): that rule
 * is about page-level, per-tenant, cached reads. Nothing here is cacheable or
 * shared — it is one visitor's private conversation, loaded after mount exactly as
 * the original page loaded /api/sessions.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { Composer } from "./composer";
import { PrefsDialog } from "./prefs-dialog";
import { SessionList } from "./session-list";
import { Transcript } from "./transcript";
import { useChat, MAX_CONCURRENT } from "./use-chat";
import { humanSize, toPendingFile, type PendingFile } from "./upload";

/** Slack in px: a hair off the end still counts as "reading the newest". */
const NEAR_BOTTOM = 60;

export function ChatApp({
  user,
  siteName,
  configured,
  limits,
}: {
  user: { id: string } | null;
  siteName: string;
  /** False when OPENROUTER_API_KEY is unset on this deployment. */
  configured: boolean;
  limits: { maxFiles: number; maxUpload: number };
}) {
  const t = useT();
  const canChat = !!user && configured;
  const chat = useChat({ canChat });

  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [following, setFollowing] = useState(true);

  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const streaming = !!chat.openLive;

  // Auto-scroll ONLY while the reader is parked at the bottom. Forcing the view
  // down on every token makes it impossible to read back over a long answer.
  useEffect(() => {
    const node = scroller.current;
    if (!node || !following) return;
    node.scrollTop = node.scrollHeight;
    // Re-pin after layout settles: the composer can grow a line, or a code block
    // can render tall, after the first jump.
    const frame = requestAnimationFrame(() => {
      if (following && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [following, chat.messages, chat.openLive?.reply, chat.openLive?.reasoning, chat.failure]);

  /**
   * Opening or starting a chat lands the reader on its newest message.
   *
   * Done at the call sites rather than in an effect on `sessionId`: an effect that
   * only calls setState is a cascading render, and every one of these three paths
   * already knows the view is about to change.
   */
  const openChat = (id: string) => {
    setFollowing(true);
    void chat.openSession(id);
    setDrawer(false);
  };

  const startNewChat = () => {
    setFollowing(true);
    chat.newChat();
    setDrawer(false);
    textarea.current?.focus();
  };

  const jumpToLatest = () => {
    const node = scroller.current;
    if (!node) return;
    // Direct assignment, not scrollTo({behavior:"smooth"}): smooth scrolling is
    // silently ignored in some browser contexts, which would hide the pill without
    // moving the view.
    node.scrollTop = node.scrollHeight;
    setFollowing(true);
    textarea.current?.focus();
  };

  const addFiles = (picked: File[]) => {
    const next = [...files];
    for (const file of picked) {
      if (next.length >= limits.maxFiles) {
        chat.setNotice(t("chat.maxFiles", { count: limits.maxFiles }));
        break;
      }
      const total = next.reduce((n, f) => n + f.size, 0) + file.size;
      if (total > limits.maxUpload) {
        chat.setNotice(t("chat.maxUpload", { size: humanSize(limits.maxUpload) }));
        break;
      }
      next.push(toPendingFile(file));
    }
    setFiles(next);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const gone = prev[index];
      // Object URLs are a document-lifetime leak if they are never revoked, and a
      // chat session can churn through a lot of previews.
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const submit = () => {
    const message = text.trim();
    if (!message && !files.length) return;
    setText("");
    const sending = files;
    setFiles([]);
    setFollowing(true);
    void chat.send(message, sending);
  };

  const runningIds = new Set(
    Object.values(chat.live)
      .map((rec) => rec.sessionId)
      .filter((id): id is string => !!id),
  );

  const hint = (() => {
    if (chat.notice) return chat.notice;
    if (chat.openLive?.uploading) return t("chat.uploading");
    if (streaming) return t("chat.waitingHere");
    if (chat.running > 0) {
      return chat.running >= MAX_CONCURRENT
        ? t("chat.maxConcurrent", { count: MAX_CONCURRENT })
        : t("chat.othersRunning", { count: chat.running });
    }
    return "";
  })();

  const activeTitle = chat.sessions.find((s) => s.id === chat.sessionId)?.title ?? "";

  return (
    <div
      data-template="mbahgpt"
      className="flex h-[100dvh] min-h-0 bg-background text-foreground"
    >
      {/* --- sidebar. Pinned from md up, a drawer below it. ------------------ */}
      {drawer && (
        <button
          type="button"
          aria-label={t("chat.closeList")}
          onClick={() => setDrawer(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-transform md:static md:z-auto md:translate-x-0 ${
          drawer ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-3">
          <Link href="/" className="truncate text-sm font-semibold tracking-tight hover:opacity-70">
            {siteName}
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {/* Language and theme are NOT here. They sit in the preferences dialog
                with the account, so the top of the session list stays the session
                list — see PrefsDialog. */}
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label={t("chat.closeList")}
              className="rounded-lg px-2 py-1 text-[var(--muted)] md:hidden"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-2.5">
          <button
            type="button"
            onClick={startNewChat}
            disabled={!canChat}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40"
          >
            + {t("chat.newChat")}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {canChat ? (
            <SessionList
              sessions={chat.sessions}
              activeId={chat.sessionId}
              runningIds={runningIds}
              unread={chat.unread}
              onOpen={openChat}
              onRename={(id, title) => void chat.rename(id, title)}
              onDelete={(id) => void chat.remove(id)}
            />
          ) : (
            <p className="px-3 py-2.5 text-xs text-[var(--muted)]">
              {configured ? t("chat.signInToSave") : t("chat.inactiveHere")}
            </p>
          )}
        </div>

        <div className="space-y-1 border-t border-[var(--border)] p-2.5">
          {/* Open to signed-out visitors too: this dialog is the only place the
              theme and language controls exist, and those need no account. The
              label says which half they will get. */}
          <button
            type="button"
            onClick={() => setPrefsOpen(true)}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--muted)] transition-colors hover:bg-[var(--accent-subtle)] hover:text-foreground"
          >
            ⚙ {user ? t("chat.prefs") : t("chat.appearance")}
          </button>
          {!user && (
            <Link
              href="/login"
              className="block w-full rounded-xl bg-[var(--primary)] px-3 py-2 text-center text-sm text-[var(--primary-foreground)]"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </aside>

      {/* --- main column ----------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1">
          {/* The drawer button only exists where the sidebar is not pinned — on
              phones it is the only way to the session list. */}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={t("chat.openList")}
            className="absolute top-2.5 left-2.5 z-10 grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] shadow-sm md:hidden"
          >
            ☰
          </button>

          <div
            ref={scroller}
            onScroll={(e) => {
              const node = e.currentTarget;
              setFollowing(node.scrollHeight - node.scrollTop - node.clientHeight <= NEAR_BOTTOM);
            }}
            className="flex-1 overflow-y-auto px-4 pt-14 pb-2 md:pt-6"
          >
            <div className="mx-auto w-full max-w-3xl">
              {activeTitle && (
                <p className="mb-4 truncate font-mono text-[0.64rem] tracking-[0.12em] text-[var(--muted)] uppercase">
                  {activeTitle}
                </p>
              )}
              {!configured ? (
                <UnavailableNotice />
              ) : !user ? (
                <SignedOutNotice />
              ) : (
                <Transcript
                  messages={chat.messages}
                  live={chat.openLive}
                  failure={chat.failure}
                  onRetry={(retryText, retryFiles) => {
                    chat.clearFailure();
                    void chat.send(retryText, retryFiles, { retry: true });
                  }}
                  onEdit={(editText) => {
                    chat.clearFailure();
                    setText(editText);
                    textarea.current?.focus();
                  }}
                />
              )}
            </div>
          </div>

          {/* Floating "back to newest". The dot marks text that arrived while the
              reader was scrolled away. */}
          {!following && (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)] shadow-lg transition-colors hover:border-[var(--primary)] hover:text-foreground"
            >
              {streaming && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
              <span aria-hidden>↓</span> {t("panel.sortRecent")}
            </button>
          )}
        </div>

        <Composer
          value={text}
          onChange={setText}
          onSubmit={submit}
          onStop={chat.stop}
          busy={streaming}
          disabled={!canChat}
          disabledReason={configured ? t("chat.signInTitle") : t("chat.inactiveTitle")}
          files={files}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          hint={hint}
          textareaRef={textarea}
        />
      </div>

      <PrefsDialog open={prefsOpen} signedIn={!!user} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}

function SignedOutNotice() {
  const t = useT();
  return (
    <div className="mt-[14vh] flex flex-col items-center gap-2 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-subtle)] text-xl text-[var(--primary)]">
        ✦
      </div>
      <p className="m-0 text-base font-semibold">{t("chat.signInTitle")}</p>
      <p className="m-0 max-w-sm text-sm text-[var(--muted)]">{t("chat.signInBody")}</p>
      <Link
        href="/login"
        className="mt-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
      >
        {t("nav.signIn")}
      </Link>
    </div>
  );
}

/**
 * Said plainly rather than letting the first message fail: an unset API key is a
 * deployment state, and a visitor cannot do anything about it.
 */
function UnavailableNotice() {
  const t = useT();
  return (
    <div className="mt-[14vh] flex flex-col items-center gap-2 text-center">
      <p className="m-0 text-base font-semibold">{t("chat.inactiveTitle")}</p>
      <p className="m-0 max-w-sm text-sm text-[var(--muted)]">{t("chat.inactiveBody")}</p>
    </div>
  );
}
