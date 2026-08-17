"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  getEpubChapters,
  getEpubChapterSource,
  saveEpubChapter,
  type EpubTarget,
} from "@/lib/actions/epub-chapters";
import type { EpubChapterInfo, ChapterAsset } from "@/lib/epub-edit";
import { Button } from "@/components/ui/button";
import { RichChapterEditor, type RichEditorHandle } from "./rich-chapter-editor";
import { useT } from "@/lib/i18n/client";

// A component rather than inline JSX, so the placeholder can use the hook —
// dynamic()'s `loading` is rendered like any other component.
function EditorLoading() {
  const t = useT();
  return (
    <div className="flex h-[60vh] min-h-[280px] w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">
      {t("editor.loading")}
    </div>
  );
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <EditorLoading />,
});

/**
 * Per-chapter editor over the product's EPUB files.
 *
 * Two guardrails shape this UI. The sample and the full book are DIFFERENT files
 * with different chapter counts, so the target is always visible and switching
 * it reloads the chapter list rather than reusing indices. And an edit rewrites
 * the real archive, so a dirty buffer must never be lost silently — switching
 * chapter or target while unsaved asks first.
 *
 * Two modes, and the source view is not a leftover. The rich editor covers
 * prose, which is nearly all of it; but these books hang their typography on
 * classes (`chapter-num`, `first`, `illus-page`) that no toolbar button can
 * express, so there has to be a way down to the markup.
 */

type Msg = { ok: boolean; text: string } | null;
type Mode = "rich" | "source";
type Loaded = { html: string; css: string; assets: ChapterAsset[] };

/**
 * Whether the panel is in dark mode, tracked live.
 *
 * The app drives dark mode with a class on <html> rather than the OS setting,
 * so `prefers-color-scheme` is the wrong signal here — a user on a light OS with
 * the panel toggled dark would still get a blinding editor.
 */
function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/**
 * EPUB chapters are XHTML: a stray unclosed tag makes the whole book unreadable
 * in strict readers, not just the chapter. Catch it here, where the seller can
 * still fix it, rather than after it has been written into the archive.
 */
/** `fallback` comes from the caller: this runs outside a component, so it has no t. */
function xhtmlError(body: string, fallback: string): string | null {
  if (typeof window === "undefined") return null;
  const doc = new DOMParser().parseFromString(
    `<root xmlns="http://www.w3.org/1999/xhtml">${body}</root>`,
    "application/xhtml+xml",
  );
  const err = doc.querySelector("parsererror");
  if (!err) return null;
  const detail = (err.textContent ?? "").split("\n").find((l) => l.trim()) ?? "";
  return detail.slice(0, 160) || fallback;
}

export function EpubChapterEditor({
  pageId,
  title,
  slug,
  hasPreview,
  hasDeliverable,
}: {
  pageId: string;
  title: string;
  slug: string;
  hasPreview: boolean;
  hasDeliverable: boolean;
}) {
  const t = useT();
  const dark = useIsDark();
  const [target, setTarget] = useState<EpubTarget>(
    hasDeliverable ? "deliverable" : "preview",
  );
  const [chapters, setChapters] = useState<EpubChapterInfo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // Derived rather than stored: "no list and no error yet" IS the loading state,
  // which keeps the fetch effect from having to set a flag synchronously.
  const loadingList = chapters === null && listError === null;

  const [selected, setSelected] = useState<EpubChapterInfo | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<Mode>("rich");
  const [loadingSource, setLoadingSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  // What is currently on disk, so "dirty" means genuinely changed rather than
  // merely opened. State rather than a ref: it's read during render to drive the
  // unsaved badge and the Save button's disabled state.
  const [saved, setSaved] = useState("");
  // The rich editor is uncontrolled — reading its markup on every keystroke
  // would be wasted work — so it reports "something changed" and the parent
  // pulls the actual HTML only when saving or switching to the source view.
  const [richDirty, setRichDirty] = useState(false);
  const richRef = useRef<RichEditorHandle | null>(null);

  const dirty = selected !== null && (richDirty || source !== saved);

  const onRichChange = useCallback(() => setRichDirty(true), []);

  /** The markup as it stands in whichever editor is showing. */
  const currentHtml = useCallback(
    () => (mode === "rich" ? richRef.current?.getHtml() ?? source : source),
    [mode, source],
  );

  // Reads the chapter list for whichever file is targeted. Nothing is set before
  // the first await, so switching target renders the loading state once rather
  // than cascading a flag update through an extra render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getEpubChapters(pageId, target);
      if (cancelled) return;
      if ("error" in res) setListError(res.error);
      else setChapters(res.chapters);
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId, target]);

  // Leaving the tab mid-edit is the one case the in-app confirm can't cover.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const confirmDiscard = () =>
    !dirty || window.confirm(t("editor.discardChanges"));

  async function openChapter(ch: EpubChapterInfo) {
    if (ch.path === selected?.path) return;
    if (!confirmDiscard()) return;
    setSelected(ch);
    setMsg(null);
    setLoadingSource(true);
    setLoaded(null);
    setSource("");
    setRichDirty(false);
    const res = await getEpubChapterSource(pageId, target, ch.path);
    if ("error" in res) {
      setMsg({ ok: false, text: res.error });
      setSelected(null);
    } else {
      setLoaded({ html: res.html, css: res.css, assets: res.assets });
      setSource(res.html);
      setSaved(res.html);
    }
    setLoadingSource(false);
  }

  function switchTarget(t: EpubTarget) {
    if (t === target) return;
    if (!confirmDiscard()) return;
    // Clear here, not in the fetch effect: the two files have different chapter
    // counts, so carrying a selection across the switch would point at a chapter
    // that may not exist in the other book.
    setMsg(null);
    setChapters(null);
    setListError(null);
    setSelected(null);
    setLoaded(null);
    setSource("");
    setSaved("");
    setRichDirty(false);
    setTarget(t);
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    // Carry the rich editor's work down into the source buffer before unmounting
    // it, or switching views would silently discard the edit.
    if (mode === "rich") {
      const html = richRef.current?.getHtml();
      if (html !== null && html !== undefined) {
        setSource(html);
        setRichDirty(false);
      }
    }
    setMode(m);
  }

  const save = useCallback(async () => {
    if (!selected || saving) return;
    const html = currentHtml();
    if (html === saved) {
      setMsg({ ok: true, text: t("editor.noChanges") });
      return;
    }

    const bad = xhtmlError(html, t("editor.invalidMarkup"));
    if (bad) {
      setMsg({ ok: false, text: t("editor.markupInvalid", { detail: bad }) });
      return;
    }

    setSaving(true);
    setMsg(null);
    const res = await saveEpubChapter(pageId, target, selected.path, html);
    if ("error" in res) {
      setMsg({ ok: false, text: res.error });
    } else {
      setSource(html);
      setSaved(html);
      setRichDirty(false);
      setMsg({ ok: true, text: t("editor.epubRewritten") });
      // Chapter lengths shift after an edit; keep the list honest.
      const fresh = await getEpubChapters(pageId, target);
      if (!("error" in fresh)) setChapters(fresh.chapters);
    }
    setSaving(false);
  }, [pageId, target, selected, currentHtml, saved, saving, t]);

  // Cmd/Ctrl+S, matching the template editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <div className="space-y-4">
      {/* One row: back, what you're editing, and which file. The explanatory
          card that used to sit here is gone — the switcher labels already say
          which file is which, and it cost a screenful on every visit. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={`/panel/product/${pageId}/edit`}
          title={t("panel.backToProduct")}
          aria-label={t("panel.backToProduct")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          <p className="truncate font-mono text-xs text-[var(--muted)]">{slug}</p>
        </div>

        {hasPreview && hasDeliverable && (
          <div className="inline-flex shrink-0 rounded-lg border border-[var(--border)] p-0.5">
            <PillTab active={target === "deliverable"} onClick={() => switchTarget("deliverable")}>
              {t("product.buyerFile")}
            </PillTab>
            <PillTab active={target === "preview"} onClick={() => switchTarget("preview")}>
              {t("editor.freePreview")}
            </PillTab>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Chapter list */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
          {loadingList ? (
            <p className="p-3 text-sm text-[var(--muted)]">{t("panel.readingEpub")}</p>
          ) : listError ? (
            <p className="p-3 text-sm text-red-600 dark:text-red-400">{listError}</p>
          ) : (
            <>
              <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {chapters?.length ?? 0} bab
              </p>
              <ul className="max-h-[65vh] overflow-y-auto">
                {chapters?.map((ch) => {
                  const active = ch.path === selected?.path;
                  return (
                    <li key={ch.path}>
                      <button
                        type="button"
                        onClick={() => void openChapter(ch)}
                        aria-current={active}
                        className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
                          active
                            ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
                            : "text-foreground hover:bg-[var(--background)]"
                        }`}
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="shrink-0 font-mono text-xs text-[var(--muted)]">
                            {String(ch.index + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{ch.title}</span>
                        </span>
                        <span className="mt-0.5 block pl-7 text-xs text-[var(--muted)]">
                          {ch.chars.toLocaleString("id-ID")} karakter
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Editor */}
        <div className="min-w-0 space-y-3">
          {!selected ? (
            <div className="flex h-[60vh] min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] px-6 text-center">
              <p className="text-sm text-[var(--muted)]">
                {t("editor.pickChapter")}
              </p>
            </div>
          ) : loadingSource || !loaded ? (
            <div className="flex h-[60vh] min-h-[280px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <p className="text-sm text-[var(--muted)]">{t("panel.openingChapter")}</p>
            </div>
          ) : (
            <>
              {/* No chapter title above the editor: the chapter is already
                  selected and highlighted in the list beside it, and the book's
                  own heading is the first thing inside the editor itself. */}
              {mode === "rich" ? (
                <RichChapterEditor
                  // A new chapter is a new document — never reuse the iframe, or
                  // the previous chapter's undo stack and styles come with it.
                  key={`${target}:${selected.path}`}
                  html={source}
                  css={loaded.css}
                  assets={loaded.assets}
                  onChange={onRichChange}
                  handleRef={richRef}
                />
              ) : (
                <MonacoEditor
                  height="60vh"
                  defaultLanguage="html"
                  theme={dark ? "vs-dark" : "light"}
                  path={`${target}:${selected.path}`}
                  value={source}
                  onChange={(v) => setSource(v ?? "")}
                  options={{
                    minimap: { enabled: false },
                    wordWrap: "on",
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                  }}
                />
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button size="md" onClick={() => void save()} disabled={saving || !dirty}>
                  {saving ? t("common.saving") : t("editor.saveChapter")}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {t("editor.orPress", { key: navigatorIsMac() ? "⌘" : "Ctrl" })}
                </span>
                {dirty && (
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {t("editor.unsaved")}
                  </span>
                )}
                {msg && (
                  <span
                    className={`text-sm ${
                      msg.ok ? "text-[var(--primary)]" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {msg.text}
                  </span>
                )}
                {/* View switch sits with the action row, right-aligned — it's a
                    control for the editor below it, not a page-level tab. */}
                <div className="ml-auto inline-flex shrink-0 rounded-lg border border-[var(--border)] p-0.5">
                  <PillTab active={mode === "rich"} onClick={() => switchMode("rich")}>
                    {t("editor.richText")}
                  </PillTab>
                  <PillTab active={mode === "source"} onClick={() => switchMode("source")}>
                    {t("editor.htmlSource")}
                  </PillTab>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PillTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
          : "text-[var(--muted)] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function navigatorIsMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
