"use client";

/**
 * The conversation itself.
 *
 * The asymmetry is the point: what you said sits right, in a tinted card; what the
 * model said runs the full column as a document, with a small accent dot for a
 * name row. That difference in SHAPE is what makes a transcript scannable — labels
 * reading "Anda" / "MbahGPT" on every turn never were.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Markdown } from "./markdown";
import { CopyButton } from "./copy-button";
import { humanSize, type PendingFile } from "./upload";
import type { ChatFailure, LiveReply, Source } from "./use-chat";
import type { ChatAttachmentRow, ChatMessageRow } from "@/lib/actions/chat";

/** Files on a stored message: images render, documents stay as links. */
function Attachments({ files, align }: { files: ChatAttachmentRow[]; align: "start" | "end" }) {
  if (!files.length) return null;
  return (
    <div className={`mb-2 flex flex-wrap gap-2 ${align === "end" ? "justify-end" : ""}`}>
      {files.map((file) =>
        file.kind === "image" ? (
          /* Plain <img>: the source is a redirect to a signed URL that changes every
             hour, so next/image could neither optimise nor cache it usefully.
             Not lazy either — before it loads the box is a few pixels tall, and the
             lazy heuristic then never fetches it at all. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={file.id}
            src={`/api/mbahgpt/attachment/${file.id}`}
            alt={file.name}
            className="max-h-52 max-w-52 min-h-12 min-w-16 rounded-xl border border-[var(--border)] bg-[var(--code-bg)] object-cover"
          />
        ) : (
          <a
            key={file.id}
            href={`/api/mbahgpt/attachment/${file.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--code-bg)] px-2.5 py-1.5 text-xs transition-colors hover:border-[var(--primary)]"
          >
            <span aria-hidden>📄</span>
            {file.name} · {humanSize(file.size)}
          </a>
        ),
      )}
    </div>
  );
}

/** Files that have not been stored yet — shown from the local copy while sending. */
function LocalAttachments({ files }: { files: PendingFile[] }) {
  if (!files.length) return null;
  return (
    <div className="mb-2 flex flex-wrap justify-end gap-2">
      {files.map((file, i) =>
        file.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={file.previewUrl}
            alt={file.name}
            className="max-h-52 max-w-52 rounded-xl border border-[var(--border)] object-cover opacity-80"
          />
        ) : (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--code-bg)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
          >
            <span aria-hidden>📄</span>
            {file.name} · {humanSize(file.size)}
          </span>
        ),
      )}
    </div>
  );
}

function UserMessage({ content, children }: { content: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col items-end">
      {children}
      <div className="max-w-[min(85%,34rem)] rounded-[18px_18px_4px_18px] bg-[var(--accent-subtle)] px-4 py-3 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] shadow-sm">
        {content}
      </div>
    </div>
  );
}

const ROLE_LABEL =
  "mb-1.5 flex items-center gap-1.5 font-mono text-[0.64rem] tracking-[0.12em] text-[var(--muted)] uppercase";

function AssistantFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="group mb-6">
      <div className={ROLE_LABEL}>
        <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--primary)]" />
        MbahGPT
      </div>
      {children}
    </div>
  );
}

/**
 * The reasoning panel, closed by default with a running seconds counter.
 *
 * A thinking model can be silent for a long time — 95 seconds, measured. Silence
 * reads as a hang, but showing the whole train of thought is noise. The compromise:
 * the reader can see the system is alive, the text is one click away, and it takes
 * up one line.
 */
function ThinkingPanel({
  reasoning,
  startedAt,
  thoughtMs,
  live,
}: {
  reasoning: string;
  startedAt?: number;
  thoughtMs?: number | null;
  live: boolean;
}) {
  const t = useT();
  const [seconds, setSeconds] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!live || thoughtMs != null || !startedAt) return;
    const tick = () => setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    // Cleared on every exit — finished, stopped, errored, or the reader switching
    // chats. A ticking interval behind a discarded panel was a real leak here.
    return () => clearInterval(timer);
  }, [live, thoughtMs, startedAt]);

  // Follow the newest reasoning, but only inside its own box.
  useEffect(() => {
    if (live && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [reasoning, live]);

  const label =
    thoughtMs != null
      ? t("chat.thoughtFor", { seconds: (thoughtMs / 1000).toFixed(1) })
      : live
        ? t("chat.thinking", { seconds })
        : t("chat.reasoning");

  return (
    <details className="mb-3 border-l-2 border-[var(--border)] pl-3 open:border-[var(--primary)]">
      <summary className="cursor-pointer list-none text-xs text-[var(--muted)] marker:hidden">{label}</summary>
      <div
        ref={scroller}
        className="mt-1.5 max-h-56 overflow-y-auto text-[0.84rem] text-[var(--muted)] whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        {reasoning}
      </div>
    </details>
  );
}

function SourcesList({ sources }: { sources: Source[] }) {
  // Hooks run before the early return: a component that bails out first would
  // change its hook count between renders the moment a search returns nothing.
  const t = useT();
  if (!sources.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--code-bg)] px-3.5 py-2.5 text-sm">
      <div className="mb-1 font-mono text-[0.66rem] tracking-[0.06em] text-[var(--muted)] uppercase">{t("chat.sources")}</div>
      <ol className="list-decimal space-y-0.5 pl-5">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              {source.title || source.url}
            </a>
            <span className="ml-1.5 text-xs text-[var(--muted)]">{hostname(source.url)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const CHIP =
  "mb-2 inline-block rounded-full border border-[var(--border)] bg-[var(--code-bg)] px-2.5 py-0.5 text-[0.7rem] text-[var(--muted)]";

/** The emoji stays in code, not in the dictionary: it is the same in every language. */
function webChipText(live: LiveReply, t: Translate): string {
  if (live.webFailed) return `🌐 ${t("chat.webFailed")}`;
  if (!live.reply) {
    return `🌐 ${live.query ? t("chat.webSearched", { query: live.query }) : t("chat.webSearching")}`;
  }
  return `🌐 ${
    live.citations.length ? t("chat.webAnswered", { count: live.citations.length }) : t("chat.webNothing")
  }`;
}

type Translate = ReturnType<typeof useT>;

export function Transcript({
  messages,
  live,
  failure,
  canUpgrade,
  onRetry,
  onEdit,
}: {
  messages: ChatMessageRow[];
  live: LiveReply | null;
  failure: ChatFailure | null;
  /**
   * Whether this storefront has a tier to sell this visitor. False turns the two
   * upgrade offers below back into plain statements — a locked feature is worth
   * naming even where nothing can be done about it, but a button that leads to a
   * 404 is not.
   */
  canUpgrade: boolean;
  onRetry: (text: string, files: PendingFile[]) => void;
  onEdit: (text: string) => void;
}) {
  const t = useT();
  const empty = !messages.length && !live && !failure;

  if (empty) {
    return (
      <div className="mt-[16vh] flex flex-col items-center gap-1 text-center text-[var(--muted)]">
        {/* A ring of brass rather than a filled disc: the poster's marks are all
            outline and rule work, and a solid blob of accent is the one shape it
            never uses. */}
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-full border border-[var(--rule)] bg-[var(--accent-subtle)] text-xl text-[var(--accent)]">
          ✦
        </div>
        <p className="m-0 font-[family-name:var(--font-auman)] text-2xl text-foreground">
          {t("chat.emptyTitle")}
        </p>
        {/* The flourish between title and instruction — the poster puts one under
            every heading, and it is the cheapest part of the identity to carry. */}
        <div aria-hidden className="my-1 flex items-center gap-2 text-[var(--accent)]">
          <span className="h-px w-8 bg-[var(--rule)]" />
          <span className="text-[0.6rem]">❖</span>
          <span className="h-px w-8 bg-[var(--rule)]" />
        </div>
        <p className="m-0 max-w-sm text-sm">{t("chat.emptyBody")}</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} content={message.content}>
            <Attachments files={message.attachments} align="end" />
          </UserMessage>
        ) : (
          <AssistantFrame key={message.id}>
            {message.reasoning && <ThinkingPanel reasoning={message.reasoning} live={false} />}
            <Attachments files={message.attachments} align="start" />
            <div className="leading-[1.72]">
              <Markdown source={message.content} />
            </div>
            <SourcesList sources={message.sources} />
            {message.content && (
              <div className="mt-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-[900px]:opacity-80">
                {/* The MARKDOWN SOURCE, not the rendered text: pasting elsewhere
                    should keep the headings, bold and code fences. */}
                <CopyButton getText={() => message.content} label={t("chat.copyAnswer")} />
              </div>
            )}
          </AssistantFrame>
        ),
      )}

      {live && (
        <>
          {live.showUserBubble && (
            <UserMessage content={live.userText}>
              <LocalAttachments files={live.userFiles} />
            </UserMessage>
          )}
          <AssistantFrame>
            {live.savedMemories > 0 && (
              <div className={CHIP} title={t("chat.memoryHint")}>
                {`🧠 ${
                  live.savedMemories === 1
                    ? t("chat.memorySavedOne")
                    : t("chat.memorySaved", { count: live.savedMemories })
                }`}
              </div>
            )}
            {live.webSearch && <div className={CHIP}>{webChipText(live, t)}</div>}
            {/* The one chip that names something the reader can DO something
                about, so it is the one chip that is a link. The rest report what
                happened; this reports what did not, and why. */}
            {live.webLocked &&
              (canUpgrade ? (
                <Link
                  href="/upgrade"
                  className={`${CHIP} transition-colors hover:border-[var(--primary)] hover:text-foreground`}
                >
                  {`🔒 ${t("chat.webLocked")} →`}
                </Link>
              ) : (
                <div className={CHIP}>{`🔒 ${t("chat.webLocked")}`}</div>
              ))}
            {live.reasoning && (
              <ThinkingPanel
                reasoning={live.reasoning}
                startedAt={live.startedAt}
                thoughtMs={live.thoughtMs}
                live
              />
            )}
            <div className="leading-[1.72]">
              <Markdown source={live.reply} />
              {/* A blinking block while nothing has arrived yet, so the empty
                  answer still reads as "in progress" rather than as broken. */}
              {!live.reply && (
                <span className="animate-pulse text-[var(--primary)]" aria-label={t("chat.waitingAnswer")}>
                  ▍
                </span>
              )}
            </div>
            <SourcesList sources={live.citations} />
          </AssistantFrame>
        </>
      )}

      {failure && (
        <div className="mb-6 border-l-[3px] border-red-500 pl-3">
          <div className={ROLE_LABEL}>{t("chat.errorLabel")}</div>
          <p className="m-0 text-red-600 dark:text-red-400">{failure.message}</p>
          {/* Retyping a long prompt because the server blipped is pure friction, so
              the failed message stays one click from being sent again. */}
          <div className="mt-2 flex flex-wrap gap-2">
            {/* Only when the server said a bigger plan would have taken the
                message. This is the wall /upgrade was written for — the reader is
                stopped, holding a prompt, and the fix is one click rather than a
                page they have to know exists. It leads the row, ahead of Retry,
                because retrying is exactly what will not work. */}
            {failure.upgrade && canUpgrade && (
              <Link
                href="/upgrade"
                className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-xs text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
              >
                {t("plan.upgrade")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => onRetry(failure.text, failure.files)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--primary)]"
            >
              ↻ {t("chat.retry")}
            </button>
            <button
              type="button"
              onClick={() => onEdit(failure.text)}
              title={t("chat.editMessageHint")}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--primary)]"
            >
              {t("chat.editMessage")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
