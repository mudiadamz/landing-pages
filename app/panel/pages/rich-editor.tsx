"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small rich-text editor: toolbar plus a contentEditable surface.
 *
 * No editor library. The panel has exactly one other WYSIWYG (the EPUB chapter
 * editor) and it is contentEditable too, so adding ProseMirror or Lexical here
 * would put a second editing model — and a few hundred KB — in the bundle to do
 * what document.execCommand already does for bold, lists and links.
 *
 * The surface is UNCONTROLLED. Writing innerHTML back on every keystroke resets
 * the caret to the start, which is the classic way a contentEditable "types
 * backwards"; markup goes in once on mount and is read out on demand.
 */
export type RichEditorHandle = { getHtml: () => string };

export function RichEditor({
  initialHtml,
  onDirty,
  editorRef,
}: {
  initialHtml: string;
  onDirty?: () => void;
  editorRef: React.RefObject<RichEditorHandle | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    // initialHtml only on mount, by design — see the note above about the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    editorRef.current = { getHtml: () => ref.current?.innerHTML ?? "" };
  }, [editorRef]);

  /** execCommand is deprecated and still the only thing every browser agrees on. */
  const cmd = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    onDirty?.();
  };

  const openLink = () => {
    const sel = window.getSelection();
    // The dialog steals the selection, so remember it before opening.
    savedRange.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    setLinkUrl("https://");
    setLinkOpen(true);
  };

  const applyLink = () => {
    setLinkOpen(false);
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) return;
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    cmd("createLink", url);
  };

  const Btn = ({
    label,
    title,
    onClick,
    wide,
  }: {
    label: string;
    title: string;
    onClick: () => void;
    wide?: boolean;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      // onMouseDown, not onClick: clicking a button blurs the editable and the
      // selection goes with it, so the command would apply to nothing.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex h-9 items-center justify-center rounded-lg px-2 text-sm text-foreground transition-colors hover:bg-[var(--accent-subtle)] ${
        wide ? "min-w-11" : "w-9"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] p-1.5">
        <Btn label="B" title="Tebal" onClick={() => cmd("bold")} />
        <Btn label="I" title="Miring" onClick={() => cmd("italic")} />
        <Btn label="U" title="Garis bawah" onClick={() => cmd("underline")} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <Btn label="H2" title="Judul" wide onClick={() => cmd("formatBlock", "<h2>")} />
        <Btn label="H3" title="Sub-judul" wide onClick={() => cmd("formatBlock", "<h3>")} />
        <Btn label="¶" title="Paragraf" onClick={() => cmd("formatBlock", "<p>")} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <Btn label="•" title="Daftar" onClick={() => cmd("insertUnorderedList")} />
        <Btn label="1." title="Daftar bernomor" wide onClick={() => cmd("insertOrderedList")} />
        <Btn label="❝" title="Kutipan" onClick={() => cmd("formatBlock", "<blockquote>")} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <Btn label="🔗" title="Tautan" onClick={openLink} />
        <Btn label="⛓" title="Hapus tautan" onClick={() => cmd("unlink")} />
        <Btn label="⌫" title="Hapus format" wide onClick={() => cmd("removeFormat")} />
      </div>

      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--background)]/50 p-2">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyLink()}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              applyLink();
            }}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Pasang
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:text-foreground"
          >
            Batal
          </button>
        </div>
      )}

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={onDirty}
        role="textbox"
        aria-multiline="true"
        aria-label="Isi halaman"
        className="page-editor min-h-[22rem] w-full px-4 py-3 text-base leading-relaxed text-foreground outline-none"
      />
    </div>
  );
}
