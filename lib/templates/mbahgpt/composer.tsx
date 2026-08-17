"use client";

/**
 * The composer: one rounded surface that contains everything.
 *
 * The controls sit INSIDE the box rather than in a row beside it, so what dominates
 * visually is the place you type — not the buttons. Clicking anywhere on the
 * surface, padding included, puts the caret in the field.
 *
 * One button, two roles. Idle it submits; while a reply streams it becomes a stop
 * button in the same spot. Two buttons there would mean one of them is always
 * doing nothing.
 */

import { useEffect, useRef, type RefObject } from "react";
import { useT } from "@/lib/i18n/client";
import { humanSize, type PendingFile } from "./upload";

/** Height the box grows to before it starts scrolling instead. */
const GROW_MAX = 176;

const ACCEPT = [
  "image/png", "image/jpeg", "image/webp", "image/gif",
  ".pdf", ".txt", ".md", ".csv", ".json", ".log", ".py", ".js", ".ts",
  ".html", ".css", ".yml", ".yaml", ".xml", ".sql", ".sh",
].join(",");

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  waiting = false,
  disabled,
  disabledReason,
  files,
  onAddFiles,
  onRemoveFile,
  hint,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  /** A reply is streaming into the chat on screen. */
  busy: boolean;
  /**
   * A reply is running that this tab is not producing — another tab, another
   * device, or a lock left behind by a reader who reloaded. Closes the box the
   * same way `busy` does, but offers no stop button: there is nothing here to
   * stop, and a button that does nothing is worse than no button.
   */
  waiting?: boolean;
  /** No signed-in user, or the feature is unconfigured. */
  disabled: boolean;
  disabledReason?: string;
  files: PendingFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  /** Status line under the box. Empty means nothing to say — and says nothing. */
  hint: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useT();
  const filePicker = useRef<HTMLInputElement>(null);

  // Grow with the content up to a ceiling, then scroll. Driven from here rather
  // than by CSS because a textarea has no content-based height.
  useEffect(() => {
    const area = textareaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, GROW_MAX)}px`;
  }, [value, textareaRef]);

  // Both mean "not now". They differ only in what the button offers.
  const blocked = busy || waiting;
  const canSend = !disabled && (!!value.trim() || files.length > 0);

  return (
    <div className="px-3 pb-3 sm:px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked || !canSend) return;
          onSubmit();
        }}
        onMouseDown={(e) => {
          // The whole box reads as the typing area; clicking its padding should
          // focus the field rather than doing nothing.
          if ((e.target as HTMLElement).closest("button, textarea, input, a")) return;
          e.preventDefault();
          textareaRef.current?.focus();
        }}
        className="mx-auto w-full max-w-3xl rounded-[26px] border border-[var(--border)] bg-[var(--card)] px-4 pt-3 pb-2 shadow-lg transition-colors focus-within:border-[var(--primary)]"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || blocked}
          placeholder={disabled ? (disabledReason ?? t("chat.unavailable")) : t("chat.placeholder")}
          enterKeyHint="send"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!blocked && canSend) onSubmit();
            }
          }}
          // 16px on phones: under that, Safari zooms the page on focus and never
          // zooms back out.
          className="max-h-44 w-full resize-none border-0 bg-transparent text-base outline-none placeholder:text-[var(--muted)]/70 disabled:opacity-60"
        />

        {files.length > 0 && (
          <div className="mt-1 mb-2 flex flex-wrap gap-1.5">
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex max-w-60 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--code-bg)] py-1 pr-1 pl-2 text-xs"
              >
                {file.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.previewUrl} alt="" className="h-6 w-6 rounded object-cover" />
                )}
                <span className="truncate">{file.name}</span>
                <span className="text-[0.68rem] text-[var(--muted)]">{humanSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(i)}
                  title={t("chat.removeAttachment")}
                  aria-label={t("chat.removeNamed", { name: file.name })}
                  className="rounded px-1 text-[var(--muted)] transition-colors hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center justify-end gap-1.5">
          <input
            ref={filePicker}
            type="file"
            multiple
            hidden
            accept={ACCEPT}
            onChange={(e) => {
              onAddFiles([...(e.target.files ?? [])]);
              // So the same file can be picked again after being removed.
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => filePicker.current?.click()}
            disabled={disabled || blocked}
            title={t("chat.attachTitle")}
            aria-label={t("chat.attachLabel")}
            className="mr-auto grid h-11 w-11 place-items-center rounded-full text-2xl leading-none text-[var(--muted)] transition-colors hover:text-[var(--primary)] disabled:opacity-40"
          >
            +
          </button>

          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={t("chat.stop")}
              className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-white transition-opacity hover:opacity-90"
            >
              ■
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend || waiting}
              aria-label={t("contact.sendMessage")}
              className="grid h-11 w-11 place-items-center rounded-full bg-[var(--primary)] text-lg text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              ↑
            </button>
          )}
        </div>
      </form>

      {/* Empty while idle, and invisible while empty: this line is for real status
          ("menunggu jawaban", "maksimal 3 chat"), not for standing tips — a tip
          that is always on screen stops being read after the first day. */}
      {hint && (
        <p role="status" className="mx-auto mt-1.5 max-w-3xl px-4 text-xs text-[var(--muted)]">
          {hint}
        </p>
      )}
    </div>
  );
}
