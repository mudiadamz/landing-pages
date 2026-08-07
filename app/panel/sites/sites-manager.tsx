"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSite, updateSite, deleteSite } from "@/lib/actions/sites";
// Type-only, so nothing from site-resolve (which reads headers()) reaches the client.
import type { Site } from "@/lib/site-resolve";
import type { LandingPageCategory } from "@/lib/actions/landing-pages";
import { DomainSetupGuide } from "./domain-setup-guide";
import { VercelDomainStatus } from "./vercel-domain-status";

type Draft = {
  host: string;
  name: string;
  tagline: string;
  description: string;
  categoryIds: string[];
  active: boolean;
};

const EMPTY: Draft = {
  host: "",
  name: "",
  tagline: "",
  description: "",
  categoryIds: [],
  active: true,
};

const CARD =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-sm";
const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

export function SitesManager({
  sites,
  rootCategories,
  canonicalHost,
  supabaseProjectUrl,
  vercelAutomated,
}: {
  sites: Site[];
  rootCategories: LandingPageCategory[];
  canonicalHost: string;
  supabaseProjectUrl: string;
  vercelAutomated: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // null = nothing open, "new" = the add form, otherwise the site id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function openNew() {
    setDraft(EMPTY);
    setEditing("new");
    setMessage(null);
  }

  function openEdit(site: Site) {
    setDraft({
      host: site.host,
      name: site.name,
      tagline: site.tagline ?? "",
      description: site.description ?? "",
      categoryIds: site.category_ids ?? [],
      active: site.active,
    });
    setEditing(site.id);
    setMessage(null);
  }

  function toggleCategory(id: string) {
    setDraft((d) => ({
      ...d,
      categoryIds: d.categoryIds.includes(id)
        ? d.categoryIds.filter((x) => x !== id)
        : [...d.categoryIds, id],
    }));
  }

  function save() {
    const editingId = editing;
    startTransition(async () => {
      // Branched rather than a ternary: only createSite reports a Vercel outcome, and
      // narrowing a union of the two return shapes loses that field.
      if (editingId === "new") {
        const res = await createSite(draft);
        if (!res.ok) {
          setMessage({ type: "err", text: res.error ?? "Gagal menyimpan." });
          return;
        }
        // The row is saved either way; what to say depends on how far Vercel got.
        const v = res.vercel;
        if (!v || v.kind === "not-configured") {
          setMessage({
            type: "ok",
            text: `Domain ${draft.host} ditambahkan. Jangan lupa tambahkan juga di Vercel.`,
          });
        } else if (v.kind === "error") {
          setMessage({
            type: "err",
            text: `Domain ${draft.host} tersimpan, tapi gagal ditambahkan ke Vercel: ${v.error}`,
          });
        } else {
          setMessage({
            type: "ok",
            text: v.state.verified
              ? `Domain ${draft.host} ditambahkan & aktif di Vercel. Tinggal langkah Supabase.`
              : `Domain ${draft.host} ditambahkan ke Vercel — menunggu DNS. Record-nya ada di kartu domain.`,
          });
        }
      } else {
        const res = await updateSite(editingId!, draft);
        if (!res.ok) {
          setMessage({ type: "err", text: res.error ?? "Gagal menyimpan." });
          return;
        }
        setMessage({ type: "ok", text: "Perubahan tersimpan." });
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(site: Site) {
    if (
      !confirm(
        `Hapus domain ${site.host}?\n\nPengaturan khusus domain ini (hero, popup, tracking, custom JS) ikut terhapus. Produk tidak terpengaruh.\n\nDomainnya TETAP terdaftar di Vercel — lepas sendiri di sana kalau memang mau dilepas.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteSite(site.id);
      setMessage(
        res.ok
          ? { type: "ok", text: `Domain ${site.host} dihapus.` }
          : { type: "err", text: res.error ?? "Gagal menghapus." },
      );
      if (res.ok) router.refresh();
    });
  }

  const nicheLabel = (site: Site) => {
    const ids = site.category_ids ?? [];
    if (ids.length === 0) return "Seluruh katalog";
    const names = rootCategories.filter((c) => ids.includes(c.id)).map((c) => c.name);
    return names.length ? names.join(", ") : "Kategori terhapus";
  };

  return (
    <div className="space-y-4">
      {message && (
        <p
          className={`rounded-xl border px-3 py-2.5 text-sm ${
            message.type === "ok"
              ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
              : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Adding a row here only makes the app READY to serve a domain. Vercel makes
          the domain reach it and Supabase lets people sign in on it — both easy to
          forget, and both fail in ways that look like a bug in this screen. */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
        <p className="font-medium text-foreground">Menambah domain butuh tiga tempat</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-[var(--muted)]">
          <li>
            <strong className="text-foreground">Di sini</strong> — nama, niche, dan pengaturan
            per domain.
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — supaya domainnya sampai ke
            aplikasi ini.{" "}
            {vercelAutomated ? (
              <span className="text-green-700 dark:text-green-400">
                Otomatis — panel ini yang menambahkannya.
              </span>
            ) : (
              <span>Manual, lihat panduan per domain.</span>
            )}
          </li>
          <li>
            <strong className="text-foreground">Supabase</strong> — supaya pengunjung bisa login
            di domain itu.
          </li>
        </ol>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Tiap domain di bawah punya panduan langkah 2 &amp; 3 dengan nilai yang sudah terisi —
          buka &ldquo;Langkah di luar panel ini&rdquo;. Referensi lengkap:{" "}
          <span className="font-mono text-foreground">docs/multi-domain.md</span>.
        </p>
      </div>

      {/* Existing domains */}
      <ul className="space-y-3">
        {sites.map((site) => (
          <li key={site.id} className={CARD}>
            {editing === site.id ? (
              <SiteForm
                draft={draft}
                setDraft={setDraft}
                rootCategories={rootCategories}
                toggleCategory={toggleCategory}
                onSave={save}
                onCancel={() => setEditing(null)}
                pending={pending}
                lockHost={site.is_canonical}
              />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {site.host}
                    </span>
                    {site.is_canonical && (
                      <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]">
                        utama · panel &amp; pembayaran
                      </span>
                    )}
                    {!site.active && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        nonaktif
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-foreground">{site.name}</p>
                  {site.tagline && (
                    <p className="text-xs text-[var(--muted)]">{site.tagline}</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Niche: <span className="text-foreground">{nicheLabel(site)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(site)}>
                    Edit
                  </Button>
                  {!site.is_canonical && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => remove(site)}
                      disabled={pending}
                    >
                      Hapus
                    </Button>
                  )}
                </div>
              </div>
            )}

            {editing !== site.id && !site.is_canonical && (
              <div className="mt-3 space-y-2">
                <VercelDomainStatus host={site.host} />
                <DomainSetupGuide
                  host={site.host}
                  supabaseProjectUrl={supabaseProjectUrl}
                  canonicalHost={canonicalHost}
                  vercelAutomated={vercelAutomated}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Add */}
      {editing === "new" ? (
        <div className={CARD}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Domain baru</h2>
          <SiteForm
            draft={draft}
            setDraft={setDraft}
            rootCategories={rootCategories}
            toggleCategory={toggleCategory}
            onSave={save}
            onCancel={() => setEditing(null)}
            pending={pending}
            lockHost={false}
          />
        </div>
      ) : (
        <Button onClick={openNew} disabled={pending}>
          Tambah domain
        </Button>
      )}
    </div>
  );
}

function SiteForm({
  draft,
  setDraft,
  rootCategories,
  toggleCategory,
  onSave,
  onCancel,
  pending,
  lockHost,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  rootCategories: LandingPageCategory[];
  toggleCategory: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  lockHost: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Domain <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={draft.host}
            onChange={(e) => setDraft((d) => ({ ...d, host: e.target.value }))}
            placeholder="resepku.com"
            disabled={lockHost}
            className={`${INPUT} font-mono disabled:opacity-60`}
          />
          <p className="text-xs text-[var(--muted)]">
            {lockHost
              ? "Domain utama tidak bisa diubah di sini."
              : "Tanpa https:// dan tanpa garis miring. Boleh subdomain."}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Nama situs <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Resepku"
            className={INPUT}
          />
          <p className="text-xs text-[var(--muted)]">Dipakai di judul tab, OG, dan JSON-LD.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Tagline</label>
        <input
          type="text"
          value={draft.tagline}
          onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
          placeholder="Resep rumahan yang beneran jadi"
          maxLength={120}
          className={INPUT}
        />
        <p className="text-xs text-[var(--muted)]">
          Muncul di judul tab: <span className="font-mono">{draft.name || "Nama"} — tagline</span>.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Deskripsi (SEO)</label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          rows={3}
          maxLength={200}
          placeholder="Kalimat yang tampil di hasil pencarian Google…"
          className={`${INPUT} resize-y`}
        />
        <p className="text-xs text-[var(--muted)]">
          Ini snippet di Google — beda pekerjaan dari tagline, jadi tulis 120–160 karakter.
          Sekarang {draft.description.trim().length}. Kosong = pakai teks bawaan.
        </p>
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">Niche (kategori)</span>
        {rootCategories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--muted)]">
            Belum ada kategori induk. Buat dulu di Kategori.
          </p>
        ) : (
          <div className="space-y-1 rounded-xl border border-[var(--border)] p-2">
            {rootCategories.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--background)]"
              >
                <input
                  type="checkbox"
                  checked={draft.categoryIds.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="truncate text-foreground">{c.name}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--muted)]">
          Sub-kategori ikut otomatis. <strong className="text-foreground">Kosong</strong> = tampilkan
          seluruh katalog (itu yang dipakai domain utama).
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">Aktif</span>
          <span className="block text-xs text-[var(--muted)]">
            Kalau dimatikan, domain ini menampilkan situs utama — bukan halaman error.
          </span>
        </span>
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Batal
        </Button>
        <Button onClick={onSave} loading={pending} disabled={pending}>
          Simpan
        </Button>
      </div>
    </div>
  );
}
