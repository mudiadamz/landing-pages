"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterAsset } from "@/lib/epub-edit";
import { useT } from "@/lib/i18n/client";

/**
 * WYSIWYG editor for one EPUB chapter.
 *
 * Rendered inside an iframe on purpose. These books carry their typography in
 * classes — `chapter-num`, `first`, `dialog`, `illus-page` — so editing without
 * the book's own stylesheet means editing blind, and injecting that stylesheet
 * into the panel would repaint the panel itself (EPUB CSS is full of bare `p`,
 * `h1`, `body` rules). An iframe gives real fidelity and total isolation for the
 * cost of reaching through `contentDocument`.
 *
 * The body is UNCONTROLLED: markup is written in once when the chapter opens and
 * read back out on change. Re-writing innerHTML on every keystroke would reset
 * the caret, and — more importantly — round-tripping through React would strip
 * the attributes the book depends on. Whatever the seller doesn't touch comes
 * back byte-identical.
 */

export type RichEditorHandle = { getHtml: () => string | null };

const FONT_STACK = `ui-serif, Georgia, "Times New Roman", serif`;

/**
 * Dark mode for the editing surface.
 *
 * The iframe is its own document, so the panel's `html.dark` never reaches it —
 * which left a white slab glowing in the middle of a dark panel. Only COLOUR is
 * overridden here: fonts, sizes, spacing and every class the book relies on are
 * left exactly as the stylesheet defines them, so what's being edited still
 * looks like the book. `!important` is needed because the books style colour on
 * specific selectors (`h1.chapter-num`), which outranks a bare tag rule.
 *
 * Colour fidelity is deliberately traded for legibility here: this is an editing
 * surface, not a preview of how a reader sees the page.
 */
const DARK_CSS = `
  html, body { background: #17171a !important; }
  body, p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6,
  em, strong, b, i, small { color: #e7e7ea !important; }
  a { color: #7cc0ff !important; }
  hr { border-color: #3a3a40 !important; }
  ::selection { background: rgba(124, 192, 255, 0.3); }
`;

const isDark = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark");

/** Chrome and Safari still emit <b>/<i>; EPUBs want semantic tags. */
function normalizeSemantics(root: Document) {
  for (const [from, to] of [
    ["b", "strong"],
    ["i", "em"],
  ] as const) {
    for (const el of Array.from(root.body.querySelectorAll(from))) {
      const rep = root.createElement(to);
      while (el.firstChild) rep.appendChild(el.firstChild);
      for (const a of Array.from(el.attributes)) rep.setAttribute(a.name, a.value);
      el.replaceWith(rep);
    }
  }
}

export function RichChapterEditor({
  html,
  css,
  assets,
  onChange,
  handleRef,
}: {
  html: string;
  css: string;
  assets: ChapterAsset[];
  onChange: () => void;
  /** Lets the parent pull the current markup at save time. */
  handleRef: React.RefObject<RichEditorHandle | null>;
}) {
  const t = useT();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  // Swap archive-relative image srcs for data URIs so the chapter renders, and
  // remember the mapping so saving can put the originals back.
  const restoreMap = useRef<Map<string, string>>(new Map());

  // Seeded once, deliberately. The document must be written into the iframe
  // exactly once per chapter: rebuilding it because a prop changed identity
  // would blow away the caret, the selection and the undo stack mid-sentence.
  // The parent keys this component per chapter, so a new chapter is a new
  // instance and picks up fresh values here.
  const seed = useRef({ html, css, assets });

  const buildDoc = useCallback(() => {
    const { html, css, assets } = seed.current;
    const map = new Map<string, string>();
    let body = html;
    for (const a of assets) {
      map.set(a.dataUri, a.src);
      body = body.split(`"${a.src}"`).join(`"${a.dataUri}"`);
    }
    restoreMap.current = map;

    // The book's own CSS first, then a thin editing layer that only adds
    // affordances (caret room, selection outline) without touching typography.
    return `<!doctype html><html><head><meta charset="utf-8">
<style>${css}</style>
<style>
  html, body { margin: 0; }
  body {
    padding: 1.25rem 1.5rem 4rem;
    min-height: 100%;
    box-sizing: border-box;
    outline: none;
    font-family: ${FONT_STACK};
    line-height: 1.7;
    -webkit-text-size-adjust: 100%;
  }
  img { max-width: 100%; height: auto; }
  :focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  ::selection { background: rgba(37, 99, 235, 0.25); }
</style>
<style id="epub-editor-theme"></style>
</head><body data-epub-editor="1">${body}</body></html>`;
  }, []);

  // Wire the document up after the iframe navigates to its srcDoc. Doing this in
  // an effect rather than an onLoad race means the document is guaranteed
  // committed before contentEditable is set.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // No setReady(false) here: this effect runs once per mount and the parent
    // keys the component per chapter, so `ready` is already false on arrival.

    const attach = () => {
      const doc = frame.contentDocument;
      // An iframe fires `load` for its initial about:blank before srcdoc lands.
      // Attaching to that one would make the placeholder vanish early and leave
      // contentEditable on a document that is about to be thrown away.
      if (!doc?.body || doc.body.dataset.epubEditor !== "1") return;
      doc.body.contentEditable = "true";
      doc.body.spellcheck = true;
      doc.designMode = "off";

      const onInput = () => onChange();
      doc.addEventListener("input", onInput);

      // Paste as plain text. Pasting from Word or a browser drags in inline
      // styles and font tags that would end up inside the book.
      const onPaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain") ?? "";
        doc.execCommand("insertText", false, text);
      };
      doc.addEventListener("paste", onPaste);

      // Enter makes a new paragraph rather than a <div> or a stray <br>.
      doc.execCommand("defaultParagraphSeparator", false, "p");

      // Follow the panel's theme, and keep following it if it's toggled while
      // the editor is open.
      const themeTag = doc.getElementById("epub-editor-theme");
      const paint = () => {
        if (themeTag) themeTag.textContent = isDark() ? DARK_CSS : "";
      };
      paint();
      const obs = new MutationObserver(paint);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

      setReady(true);
      return () => {
        doc.removeEventListener("input", onInput);
        doc.removeEventListener("paste", onPaste);
        obs.disconnect();
      };
    };

    let cleanup: (() => void) | undefined;
    const onLoad = () => {
      cleanup = attach();
    };
    frame.addEventListener("load", onLoad);
    frame.srcdoc = buildDoc();

    return () => {
      frame.removeEventListener("load", onLoad);
      cleanup?.();
    };
  }, [buildDoc, onChange]);

  // The parent reads markup out only at save time.
  useEffect(() => {
    handleRef.current = {
      getHtml() {
        const doc = frameRef.current?.contentDocument;
        if (!doc?.body) return null;
        normalizeSemantics(doc);
        let out = doc.body.innerHTML;
        for (const [dataUri, src] of restoreMap.current) {
          out = out.split(`"${dataUri}"`).join(`"${src}"`);
        }
        return out;
      },
    };
  }, [handleRef]);

  const exec = (cmd: string, value?: string) => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    frameRef.current?.contentWindow?.focus();
    doc.execCommand(cmd, false, value);
    onChange();
  };

  const block = (tag: string) => exec("formatBlock", `<${tag}>`);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--card)] p-1.5">
        <ToolButton onClick={() => exec("bold")} title={t("editor.boldKey")}>
          <span className="font-bold">B</span>
        </ToolButton>
        <ToolButton onClick={() => exec("italic")} title={t("editor.italicKey")}>
          <span className="font-serif italic">I</span>
        </ToolButton>
        <Divider />
        <ToolButton onClick={() => block("p")} title={t("content.paragraphs")}>
          ¶
        </ToolButton>
        <ToolButton onClick={() => block("h1")} title={t("editor.heading1")}>
          H1
        </ToolButton>
        <ToolButton onClick={() => block("h2")} title={t("editor.heading2")}>
          H2
        </ToolButton>
        <ToolButton onClick={() => block("blockquote")} title={t("editor.quote")}>
          ❝
        </ToolButton>
        <Divider />
        <ToolButton onClick={() => exec("insertUnorderedList")} title={t("editor.bulletList")}>
          •—
        </ToolButton>
        <ToolButton onClick={() => exec("insertOrderedList")} title={t("editor.numberedList")}>
          1.
        </ToolButton>
        <ToolButton onClick={() => exec("insertHorizontalRule")} title={t("editor.divider")}>
          —
        </ToolButton>
        <Divider />
        <ToolButton
          onClick={() => {
            const url = window.prompt(t("editor.linkUrl"));
            if (url) exec("createLink", url);
          }}
          title={t("panel.link")}
        >
          🔗
        </ToolButton>
        <ToolButton onClick={() => exec("unlink")} title={t("editor.unlink")}>
          ⛓
        </ToolButton>
        <ToolButton onClick={() => exec("removeFormat")} title={t("editor.clearFormat")}>
          ⌫
        </ToolButton>
        <Divider />
        <ToolButton onClick={() => exec("undo")} title={t("editor.undo")}>
          ↶
        </ToolButton>
        <ToolButton onClick={() => exec("redo")} title={t("editor.redo")}>
          ↷
        </ToolButton>
      </div>

      <div className="relative bg-white dark:bg-[#17171a]">
        <iframe
          ref={frameRef}
          title={t("editor.chapterEditor")}
          className="block h-[60vh] min-h-[280px] w-full border-0"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">{t("editor.preparing")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the selection in the iframe
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm text-foreground transition-colors hover:bg-[var(--accent-subtle)] hover:text-[var(--primary)]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />;
}
