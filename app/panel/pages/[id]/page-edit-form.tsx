"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { savePage, deletePage } from "@/lib/actions/pages";
import { RichEditor, type RichEditorHandle } from "../rich-editor";
import type { EditorialPage } from "@/lib/page-types";
import { t } from "@/lib/i18n";

export function PageEditForm({ page }: { page: EditorialPage }) {
  const router = useRouter();
  const editor = useRef<RichEditorHandle | null>(null);

  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [published, setPublished] = useState(page.published);
  const [sortOrder, setSortOrder] = useState(String(page.sort_order));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);
    const res = await savePage({
      id: page.id,
      title,
      slug,
      // Read out of the editor at save time — the surface is uncontrolled, so
      // this is the only moment its markup is needed.
      content: editor.current?.getHtml() ?? page.content,
      published,
      sortOrder: Number(sortOrder) || 0,
    });
    setSaving(false);
    if (res.ok) {
      setStatus(t("common.saved"));
      router.refresh();
    } else {
      setError(res.error ?? t("common.failed"));
    }
  }

  async function remove() {
    if (!confirm(`Hapus halaman "${page.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await deletePage(page.id);
    if (res.ok) router.push("/panel/pages");
    else setError(res.error ?? t("common.failed"));
  }

  const input =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
  const label = "mb-1.5 block text-sm font-medium text-foreground";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="page-title">{t("panel.title")}</label>
          <input id="page-title" className={input} value={title} maxLength={120}
                 onChange={(e) => { setTitle(e.target.value); setStatus(null); }} />
        </div>
        <div>
          <label className={label} htmlFor="page-slug">{t("panel.url")}</label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-sm text-[var(--muted)]">/p/</span>
            <input id="page-slug" className={input} value={slug}
                   onChange={(e) => { setSlug(e.target.value); setStatus(null); }} />
          </div>
        </div>
      </div>

      <RichEditor
        initialHtml={page.content}
        editorRef={editor}
        onDirty={() => setStatus(null)}
      />

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={published}
                 onChange={(e) => { setPublished(e.target.checked); setStatus(null); }}
                 className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]" />
          {t("panel.publish")}
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          {t("panel.order")}
          <input inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                 className="w-16 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-base sm:text-sm text-foreground" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
        <Button type="button" size="md" onClick={save} disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
        {published && (
          <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer"
             className="text-sm text-[var(--muted)] hover:text-foreground">{t("panel.viewPage")}</a>
        )}
        <button type="button" onClick={remove}
                className="ml-auto text-sm text-[var(--muted)] transition-colors hover:text-red-500">
          {t("panel.deletePage")}
        </button>
        {status && <span className="text-sm text-green-600 dark:text-green-400">{status}</span>}
        {error && <span className="text-sm text-red-500 dark:text-red-400">{error}</span>}
      </div>
    </div>
  );
}
