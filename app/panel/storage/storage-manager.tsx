"use client";

import { useMemo, useState } from "react";
import { deleteStorageFile, type StorageFile } from "@/lib/actions/storage-admin";
import { useT } from "@/lib/i18n/client";

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

/** Split "a/b/c.png" into its folder and file name. Root files get "". */
function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf("/");
  return i === -1 ? { dir: "", name: path } : { dir: path.slice(0, i), name: path.slice(i + 1) };
}

type TreeNode = {
  /** Stable and unique: bucket roots key on the bucket, folders on "bucket\ndir". */
  key: string;
  /** Just this level's segment — the full path is the chain of ancestors. */
  name: string;
  /** Files sitting directly in this folder, not in a subfolder. */
  files: StorageFile[];
  children: TreeNode[];
  /** Totals for the whole subtree, so a collapsed folder still reports its weight. */
  count: number;
  size: number;
};

/**
 * Build a bucket → folder → file tree from the already-sorted, already-capped rows.
 *
 * Deliberately downstream of both: sibling order follows the best-ranked file
 * beneath each node, so picking "Terbesar" floats the branch holding the biggest
 * file rather than re-ranking folders by an aggregate nobody asked for — and the
 * visible cap keeps meaning "top 500 by the chosen sort".
 */
function buildTree(rows: StorageFile[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const index = new Map<string, TreeNode>();

  const nodeAt = (key: string, name: string, parent: TreeNode | null): TreeNode => {
    let n = index.get(key);
    if (!n) {
      n = { key, name, files: [], children: [], count: 0, size: 0 };
      index.set(key, n);
      (parent ? parent.children : roots).push(n);
    }
    return n;
  };

  for (const f of rows) {
    const segments = f.path.split("/").filter(Boolean);
    segments.pop(); // the file name itself is not a folder level
    const size = f.size ?? 0;

    let cur = nodeAt(f.bucket, f.bucket, null);
    cur.count += 1;
    cur.size += size;

    let dir = "";
    for (const s of segments) {
      dir = dir ? `${dir}/${s}` : s;
      cur = nodeAt(`${f.bucket}\n${dir}`, s, cur);
      cur.count += 1;
      cur.size += size;
    }
    cur.files.push(f);
  }
  return roots;
}

/** Every node key in the tree, for expand-all / collapse-all. */
function allKeys(nodes: TreeNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    out.push(n.key);
    allKeys(n.children, out);
  }
  return out;
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
  const t = useT();
  const [files, setFiles] = useState(initialFiles);
  const [bucket, setBucket] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null); // "bucket\npath"
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

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
  const shown = useMemo(() => sorted.slice(0, VISIBLE_CAP), [sorted]);
  const tree = useMemo(() => buildTree(shown), [shown]);

  // While searching, every folder reads as open regardless of the collapsed set:
  // a hit buried in a folded branch is a result the user cannot see. Derived
  // rather than pushed into state on change, so clearing the search restores
  // exactly the folds they had.
  const searching = query.trim().length > 0;
  const isOpen = (key: string) => searching || !collapsed.has(key);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
          {t("panel.storageTruncated")}
        </div>
      )}

      {/* Bucket filter + sort + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="storage-bucket">
            {t("panel.storageBucket")}
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
            {t("panel.sortBy")}
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
          placeholder={t("panel.storageSearch")}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>
          {filtered.length} file · {formatBytes(totalSize)}
          {filtered.length > VISIBLE_CAP && ` (menampilkan ${VISIBLE_CAP})`}
          {searching && " · folder dibuka otomatis saat mencari"}
        </span>
        <div className="flex items-center gap-3">
          {error && <span className="text-red-500">{error}</span>}
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className="font-medium text-[var(--primary)] hover:underline"
          >
            {t("panel.expandAll")}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set(allKeys(tree)))}
            className="font-medium text-[var(--primary)] hover:underline"
          >
            {t("panel.collapseAll")}
          </button>
        </div>
      </div>

      {tree.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted)]">
          {t("panel.noFiles")}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          {tree.map((n) => (
            <TreeFolder
              key={n.key}
              node={n}
              depth={0}
              isOpen={isOpen}
              toggle={toggle}
              ctx={{ confirm, busy, setConfirm, onDelete }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Everything a file row needs from the manager, passed down the recursion. */
type RowCtx = {
  confirm: string | null;
  busy: string | null;
  setConfirm: (key: string | null) => void;
  onDelete: (f: StorageFile) => void;
};

/** Indent by nesting depth. Padding rather than nested margins so a row's
 *  hover and click target still spans the full width at any depth. */
const indent = (depth: number) => ({ paddingLeft: `${0.75 + depth * 1.15}rem` });

function TreeFolder({
  node,
  depth,
  isOpen,
  toggle,
  ctx,
}: {
  node: TreeNode;
  depth: number;
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
  ctx: RowCtx;
}) {
  const open = isOpen(node.key);
  return (
    <li className="border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        onClick={() => toggle(node.key)}
        aria-expanded={open}
        style={indent(depth)}
        className="flex w-full items-center gap-2 py-2 pr-3 text-left transition-colors hover:bg-[var(--background)] sm:pr-4"
      >
        <Chevron
          className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-90" : ""}`}
        />
        <FolderIcon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={node.name}>
          {node.name}
        </span>
        <span className="shrink-0 text-[11px] text-[var(--muted)]">
          {node.count} file · {formatBytes(node.size)}
        </span>
      </button>

      {open && (node.children.length > 0 || node.files.length > 0) && (
        <ul className="border-t border-[var(--border)]">
          {node.children.map((c) => (
            <TreeFolder key={c.key} node={c} depth={depth + 1} isOpen={isOpen} toggle={toggle} ctx={ctx} />
          ))}
          {node.files.map((f) => (
            <FileRow key={`${f.bucket}\n${f.path}`} file={f} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FileRow({ file: f, depth, ctx }: { file: StorageFile; depth: number; ctx: RowCtx }) {
  const t = useT();
  const key = `${f.bucket}\n${f.path}`;
  const confirming = ctx.confirm === key;
  const deleting = ctx.busy === key;

  return (
    <li
      style={indent(depth)}
      className="flex items-center gap-3 border-b border-[var(--border)] py-2.5 pr-3 last:border-b-0 sm:pr-4"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
        {isImage(f) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.publicUrl!} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <FileGlyph mimetype={f.mimetype} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        {/* Folders are the ancestry above; the row only needs the leaf name. */}
        <p className="truncate font-mono text-xs text-foreground" title={f.path}>
          {splitPath(f.path).name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--muted)]">
          <span>{formatBytes(f.size)}</span>
          <span>{formatDate(f.updatedAt)}</span>
          {f.publicUrl && (
            <a
              href={f.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              {t("panel.open")}
            </a>
          )}
        </p>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => ctx.onDelete(f)}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Menghapus…" : "Hapus"}
          </button>
          <button
            type="button"
            onClick={() => ctx.setConfirm(null)}
            disabled={deleting}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ctx.setConfirm(key)}
          title={t("panel.deleteFile")}
          aria-label="Hapus file"
          className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
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

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
