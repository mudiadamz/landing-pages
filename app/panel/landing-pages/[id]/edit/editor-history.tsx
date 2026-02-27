"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getVersions, restoreVersion, type VersionRow } from "@/lib/actions/versions";
import { parseHtmlContent } from "@/lib/editor-utils";

export function EditorHistory({
  pageId,
  onRestore,
}: {
  pageId: string;
  onRestore: (html: string, css: string, js: string) => void;
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getVersions(pageId);
      setVersions(list);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  async function handleRestore(v: VersionRow) {
    setRestoring(v.id);
    try {
      const html = await restoreVersion(v.id);
      const parsed = parseHtmlContent(html);
      onRestore(parsed.html, parsed.css, parsed.js);
      router.refresh();
    } finally {
      setRestoring(null);
    }
  }

  function formatDate(s: string) {
    return new Date(s).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">History</h3>
      {loading ? (
        <p className="text-xs text-[var(--muted)]">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No versions yet</p>
      ) : (
        <ul className="space-y-2 max-h-[240px] overflow-y-auto">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-2 py-2 border-b border-[var(--border)] last:border-0"
            >
              <span className="text-xs text-[var(--muted)] truncate">
                {formatDate(v.created_at)}
              </span>
              <button
                type="button"
                onClick={() => handleRestore(v)}
                disabled={restoring === v.id}
                className="text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50 flex-shrink-0"
              >
                {restoring === v.id ? "Restoring…" : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
