"use client";

import { useMemo, useState } from "react";
import { deleteStorageFile, type StorageFile } from "@/lib/actions/storage-admin";

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
  } catch {
    return "—";
  }
}

const isImage = (f: StorageFile) => !!f.publicUrl && (f.mimetype?.startsWith("image/") ?? false);

const VISIBLE_CAP = 500;

/**
 * Sort orders offered in the toolbar.
 *
 * "recent" repeats the order listAllStorageFiles() already returns, so the
 * default view is unchanged and picking it again is a way back.
 */
const SORTS = {
  recent: { label: "Terbaru", cmp: (a: StorageFile, b: StorageFile) => cmpDate(b, a) },
  oldest: { label: "Terlama", cmp: (a: StorageFile, b: StorageFile) => cmpDate(a, b) },
  largest: { label: "Terbesar", cmp: (a: StorageFile, b: StorageFile) => (b.size ?? 0) - (a.size ?? 0) },
  smallest: { label: "Terkecil", cmp: (a: StorageFile, b: StorageFile) => (a.size ?? 0) - (b.size ?? 0) },
  path: { label: "Path A–Z", cmp: (a: StorageFile, b: StorageFile) => a.path.localeCompare(b.path) },
} as const;

type SortKey = keyof typeof SORTS;

/** Undated files sort last in both directions rather than clumping at the top. */
function cmpDate(a: StorageFile, b: StorageFile): number {
  if (!a.updatedAt && !b.updatedAt) return 0;
  if (!a.updatedAt) return -1;
  if (!b.updatedAt) return 1;
  return a.updatedAt.localeCompare(b.updatedAt);
}

const selectClass =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

export function StorageManager({
  initialFiles,
  buckets,
  truncated,
}: {
  initialFiles: StorageFile[];
  buckets: string[];
  truncated: boolean;
}) {
  const [files, setFiles] = useState(initialFiles);
  const [bucket, setBucket] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null); // "bucket\npath"
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of files) m.set(f.bucket, (m.get(f.bucket) ?? 0) + 1);
    return m;
  }, [files]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter(
      (f) => (bucket === "all" || f.bucket === bucket) && (!q || f.path.toLowerCase().includes(q)),
    );
  }, [files, bucket, query]);

  // Sort the whole filtered set BEFORE the visible cap. Sorting the capped
  // slice instead would make "Terbesar" mean "biggest of an arbitrary 500",
  // which is precisely the question sorting by size is asked to answer.
  const sorted = useMemo(() => [...filtered].sort(SORTS[sort].cmp), [filtered, sort]);

  const totalSize = useMemo(() => filtered.reduce((n, f) => n + (f.size ?? 0), 0), [filtered]);
  const shown = sorted.slice(0, VISIBLE_CAP);

  async function onDelete(f: StorageFile) {
    const key = `${f.bucket}\n${f.path}`;
    setBusy(key);
    setError(null);
    try {
      const res = await deleteStorageFile(f.bucket, f.path);
      if (res.ok) {
        setFiles((prev) => prev.filter((x) => !(x.bucket === f.bucket && x.path === f.path)));
      } else {
        setError(res.error ?? "Gagal menghapus file");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus file");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-4">
      {truncated && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          Daftar dipangkas pada batas maksimum. Pakai pencarian untuk mempersempit.
        </div>
      )}

      {/* Bucket filter + sort + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="storage-bucket">
            Bucket
          </label>
          <select
            id="storage-bucket"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            className={selectClass}
          >
            <option value="all">Semua bucket ({files.length})</option>
            {buckets.map((b) => (
              <option key={b} value={b}>
                {b} ({counts.get(b) ?? 0})
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="storage-sort">
            Urutkan
          </label>
          <select
            id="storage-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={selectClass}
          >
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORTS[k].label}
              </option>
            ))}
          </select>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari path file…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          {filtered.length} file · {formatBytes(totalSize)}
          {filtered.length > VISIBLE_CAP && ` (menampilkan ${VISIBLE_CAP})`}
        </span>
        {error && <span className="text-red-500">{error}</span>}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted)]">
          Tidak ada file.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm divide-y divide-[var(--border)]">
          {shown.map((f) => {
            const key = `${f.bucket}\n${f.path}`;
            const confirming = confirm === key;
            const deleting = busy === key;
            return (
              <li key={key} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  {isImage(f) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.publicUrl!} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <FileGlyph mimetype={f.mimetype} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-foreground" title={f.path}>
                    {f.path}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--muted)]">
                    <span className="rounded bg-[var(--background)] px-1.5 py-0.5 font-medium">{f.bucket}</span>
                    <span>{formatBytes(f.size)}</span>
                    <span>{formatDate(f.updatedAt)}</span>
                    {f.publicUrl && (
                      <a
                        href={f.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--primary)] hover:underline"
                      >
                        Buka
                      </a>
                    )}
                  </p>
                </div>

                {confirming ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDelete(f)}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                    >
                      {deleting ? "Menghapus…" : "Hapus"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      disabled={deleting}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirm(key)}
                    title="Hapus file"
                    aria-label="Hapus file"
                    className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FileGlyph({ mimetype }: { mimetype: string | null }) {
  const t = mimetype ?? "";
  const label = t.includes("pdf")
    ? "PDF"
    : t.includes("epub")
      ? "EPUB"
      : t.includes("zip")
        ? "ZIP"
        : t.startsWith("video/")
          ? "VID"
          : (t.split("/")[1] || "FILE").slice(0, 4).toUpperCase();
  return <span className="text-[9px] font-bold text-[var(--muted)]">{label}</span>;
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
