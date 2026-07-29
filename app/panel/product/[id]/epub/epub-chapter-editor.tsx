"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  getEpubChapters,
  getEpubChapterSource,
  saveEpubChapter,
  type EpubTarget,
} from "@/lib/actions/epub-chapters";
import type { EpubChapterInfo } from "@/lib/epub-edit";
import { Button } from "@/components/ui/button";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] min-h-[280px] w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">
      Loading editor…
    </div>
  ),
});

/**
 * Per-chapter editor over the product's EPUB files.
 *
 * Two guardrails shape this UI. The sample and the full book are DIFFERENT files
 * with different chapter counts, so the target is always visible and switching
 * it reloads the chapter list rather than reusing indices. And an edit rewrites
 * the real archive, so a dirty buffer must never be lost silently — switching
 * chapter or target while unsaved asks first.
 */

type Msg = { ok: boolean; text: string } | null;

export function EpubChapterEditor({
  pageId,
  title,
  hasPreview,
  hasDeliverable,
}: {
  pageId: string;
  title: string;
  hasPreview: boolean;
  hasDeliverable: boolean;
}) {
  const [target, setTarget] = useState<EpubTarget>(
    hasDeliverable ? "deliverable" : "preview",
  );
  const [chapters, setChapters] = useState<EpubChapterInfo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // Derived rather than stored: "no list and no error yet" IS the loading state,
  // which keeps the fetch effect from having to set a flag synchronously.
  const loadingList = chapters === null && listError === null;

  const [selected, setSelected] = useState<EpubChapterInfo | null>(null);
  const [source, setSource] = useState("");
  const [loadingSource, setLoadingSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  // What is currently on disk, so "dirty" means genuinely changed rather than
  // merely opened. State rather than a ref: it's read during render to drive the
  // unsaved badge and the Save button's disabled state.
  const [saved, setSaved] = useState("");
  const dirty = selected !== null && source !== saved;

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
    !dirty || window.confirm("Perubahan bab ini belum disimpan. Buang perubahan?");

  async function openChapter(ch: EpubChapterInfo) {
    if (ch.path === selected?.path) return;
    if (!confirmDiscard()) return;
    setSelected(ch);
    setMsg(null);
    setLoadingSource(true);
    setSource("");
    const res = await getEpubChapterSource(pageId, target, ch.path);
    if ("error" in res) {
      setMsg({ ok: false, text: res.error });
      setSelected(null);
    } else {
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
    setSource("");
    setSaved("");
    setTarget(t);
  }

  const save = useCallback(async () => {
    if (!selected || saving) return;
    if (source === saved) {
      setMsg({ ok: true, text: "Tidak ada perubahan." });
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await saveEpubChapter(pageId, target, selected.path, source);
    if ("error" in res) {
      setMsg({ ok: false, text: res.error });
    } else {
      setSaved(source);
      setMsg({ ok: true, text: "Tersimpan. File EPUB sudah ditulis ulang." });
      // Chapter lengths shift after an edit; keep the list honest.
      const fresh = await getEpubChapters(pageId, target);
      if (!("error" in fresh)) setChapters(fresh.chapters);
    }
    setSaving(false);
  }, [pageId, target, selected, source, saved, saving]);

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
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Menyimpan akan menulis ulang file EPUB-nya langsung — pembeli yang mengunduh
          setelah ini mendapat versi baru. Preview dan file pembeli adalah dua file
          berbeda dengan jumlah bab berbeda, jadi perbaikan yang sama perlu dilakukan di
          masing-masing.
        </p>

        {hasPreview && hasDeliverable && (
          <div className="mt-3 inline-flex rounded-lg border border-[var(--border)] p-0.5">
            <TargetTab active={target === "deliverable"} onClick={() => switchTarget("deliverable")}>
              File pembeli
            </TargetTab>
            <TargetTab active={target === "preview"} onClick={() => switchTarget("preview")}>
              Preview gratis
            </TargetTab>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Chapter list */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
          {loadingList ? (
            <p className="p-3 text-sm text-[var(--muted)]">Membaca file EPUB…</p>
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
                Pilih bab di sebelah kiri untuk mulai mengedit.
              </p>
            </div>
          ) : loadingSource ? (
            <div className="flex h-[60vh] min-h-[280px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <p className="text-sm text-[var(--muted)]">Membuka bab…</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {selected.title}
                </p>
                {dirty && (
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Belum disimpan
                  </span>
                )}
              </div>

              <MonacoEditor
                height="60vh"
                defaultLanguage="html"
                theme="vs-dark"
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

              <div className="flex flex-wrap items-center gap-3">
                <Button size="md" onClick={() => void save()} disabled={saving || !dirty}>
                  {saving ? "Menyimpan…" : "Simpan bab"}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  atau tekan {navigatorIsMac() ? "⌘" : "Ctrl"}+S
                </span>
                {msg && (
                  <span
                    className={`text-sm ${
                      msg.ok ? "text-[var(--primary)]" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {msg.text}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TargetTab({
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
