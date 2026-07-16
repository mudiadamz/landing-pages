"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight rich-text (WYSIWYG) editor built on a contenteditable div with
 * document.execCommand — no external dependency. Emits HTML via onChange; the
 * server re-sanitizes with an allowlist before storing (see lib/html-sanitize).
 *
 * It is uncontrolled: the initial HTML is written to the DOM once on mount, and
 * user edits flow out through onChange (setting innerHTML on every keystroke
 * would reset the caret).
 */
export function RichTextEditor({
  initialHtml,
  onChange,
  placeholder,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!initialHtml.trim());

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    // Treat whitespace-/<br>-only content as empty; only real text or an image counts.
    const isEmpty = (el.textContent?.trim() ?? "") === "" && !/<img/i.test(html);
    setEmpty(isEmpty);
    onChange(isEmpty ? "" : html);
  }

  function exec(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    sync();
  }

  function createLink() {
    const url = window.prompt("URL tautan (https://…)");
    if (!url) return;
    exec("createLink", url);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] focus-within:ring-2 focus-within:ring-[var(--primary)]/40">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] bg-[var(--card)] px-1.5 py-1">
        <ToolbarButton label="Tebal" onClick={() => exec("bold")}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton label="Miring" onClick={() => exec("italic")}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton label="Garis bawah" onClick={() => exec("underline")}>
          <span className="underline">U</span>
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Judul" onClick={() => exec("formatBlock", "H2")}>
          <span className="text-sm font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton label="Sub-judul" onClick={() => exec("formatBlock", "H3")}>
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton label="Paragraf" onClick={() => exec("formatBlock", "P")}>
          <span className="text-xs">¶</span>
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Daftar poin" onClick={() => exec("insertUnorderedList")}>
          <ListIcon />
        </ToolbarButton>
        <ToolbarButton label="Daftar bernomor" onClick={() => exec("insertOrderedList")}>
          <OrderedListIcon />
        </ToolbarButton>
        <ToolbarButton label="Tautan" onClick={createLink}>
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton label="Hapus format" onClick={() => exec("removeFormat")}>
          <ClearIcon />
        </ToolbarButton>
      </div>

      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-[var(--muted)]">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          role="textbox"
          aria-multiline="true"
          className="rich-text min-h-48 w-full resize-y overflow-auto px-3 py-2.5 text-sm leading-relaxed text-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Use onMouseDown + preventDefault so the contenteditable selection isn't lost.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--border)]" aria-hidden />;
}

function ListIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 16H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}
