"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSite, updateSiteDomain, deleteSite } from "@/lib/actions/sites";
// Type-only, so nothing from site-resolve (which reads headers()) reaches the client.
import type { Site } from "@/lib/site-resolve";
import { DomainSetupGuide } from "./domain-setup-guide";
import { VercelDomainStatus } from "./vercel-domain-status";

/**
 * The PLUMBING half of a storefront: which hostname it answers on, whether it is
 * switched on, and its state at Vercel.
 *
 * Everything cosmetic — name, tagline, search snippet, logo, icon, template,
 * palette, niche — moved to /panel/branding. The two were one form, which meant a
 * copy edit re-submitted the host field, and the screen you open to fix a logo
 * looked like the screen you open to take a domain off the air. Different risk,
 * different screen.
 */

const CARD =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-sm";
const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

type DomainDraft = { host: string; active: boolean };
type NewDraft = { host: string; name: string };

export function SitesManager({
  sites,
  canonicalHost,
  supabaseProjectUrl,
  vercelAutomated,
  templateLabels,
  paletteLabels,
}: {
  sites: Site[];
  canonicalHost: string;
  supabaseProjectUrl: string;
  vercelAutomated: boolean;
  /** key -> label, so the summary line can name the template without the registry. */
  templateLabels: Record<string, string>;
  paletteLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // null = nothing open, "new" = the add form, otherwise the site id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<DomainDraft>({ host: "", active: true });
  const [newDraft, setNewDraft] = useState<NewDraft>({ host: "", name: "" });
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function openNew() {
    setNewDraft({ host: "", name: "" });
    setEditing("new");
    setMessage(null);
  }

  function openEdit(site: Site) {
    setDraft({ host: site.host, active: site.active });
    setEditing(site.id);
    setMessage(null);
  }

  function saveDomain(id: string) {
    startTransition(async () => {
      const res = await updateSiteDomain(id, draft);
      if (!res.ok) {
        setMessage({ type: "err", text: res.error ?? "Gagal menyimpan." });
        return;
      }
      setMessage({ type: "ok", text: "Pengaturan domain tersimpan." });
      setEditing(null);
      router.refresh();
    });
  }

  function create() {
    startTransition(async () => {
      const res = await createSite(newDraft);
      if (!res.ok) {
        setMessage({ type: "err", text: res.error ?? "Gagal menyimpan." });
        return;
      }
      // The row exists either way; what to say depends on how far Vercel got.
      const v = res.vercel;
      const vercelNote =
        !v || v.kind === "not-configured"
          ? "Jangan lupa tambahkan juga di Vercel."
          : v.kind === "error"
            ? `Gagal ditambahkan ke Vercel: ${v.error}`
            : v.state.verified
              ? "Aktif di Vercel."
              : "Ditambahkan ke Vercel — menunggu DNS.";
      setMessage({
        type: v?.kind === "error" ? "err" : "ok",
        text: `Domain ${newDraft.host} ditambahkan. ${vercelNote} Lanjut atur identitas & tampilannya.`,
      });
      setEditing(null);
      router.refresh();
      // Straight to the half that is still empty. A fresh domain has default name,
      // template and palette, and leaving the admin on this screen hides that.
      if (res.id) router.push(`/panel/branding?site=${res.id}`);
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
            <strong className="text-foreground">Di sini</strong> — hostname-nya, plus
            aktif/nonaktif.
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
          Nama situs, tagline, deskripsi SEO, logo, ikon, template, palet, dan niche
          diatur di <strong className="text-foreground">Identitas situs</strong> — bukan di
          sini. Referensi lengkap:{" "}
          <span className="font-mono text-foreground">docs/multi-domain.md</span>.
        </p>
      </div>

      {/* Existing domains */}
      <ul className="space-y-3">
        {sites.map((site) => (
          <li key={site.id} className={CARD}>
            {editing === site.id ? (
              <DomainForm
                draft={draft}
                setDraft={setDraft}
                onSave={() => saveDomain(site.id)}
                onCancel={() => setEditing(null)}
                pending={pending}
                lockHost={site.is_canonical}
              />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                {(site.icon_url || site.logo_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={site.icon_url || site.logo_url || ""}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border)] object-contain"
                  />
                )}
                <div className="min-w-0 flex-1">
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
                  {/* Read-only here. The link is the only way to change it, which is
                      what keeps the two halves separate in practice and not just on
                      paper. */}
                  <p className="mt-1 text-sm text-foreground">{site.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Tampilan:{" "}
                    <span className="text-foreground">
                      {templateLabels[site.template || "default"] ?? site.template}
                    </span>
                    {" · "}Warna:{" "}
                    <span className="text-foreground">
                      {paletteLabels[site.palette || "forest"] ?? site.palette}
                    </span>
                  </p>
                  <Link
                    href={`/panel/branding?site=${site.id}`}
                    className="mt-1.5 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    Identitas &amp; tampilan →
                  </Link>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(site)}>
                    Edit domain
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
          <h2 className="mb-1 text-sm font-semibold text-foreground">Domain baru</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            Hostname dan nama dulu. Setelah tersimpan Anda langsung dibawa ke Identitas
            situs untuk logo, template, palet, dan niche.
          </p>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Domain <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDraft.host}
                  onChange={(e) => setNewDraft((d) => ({ ...d, host: e.target.value }))}
                  placeholder="resepku.com"
                  className={`${INPUT} font-mono`}
                />
                <p className="text-xs text-[var(--muted)]">
                  Tanpa https:// dan tanpa garis miring. Boleh subdomain.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Nama situs <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDraft.name}
                  onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Resepku"
                  className={INPUT}
                />
                <p className="text-xs text-[var(--muted)]">Bisa diubah nanti.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={pending}>
                Batal
              </Button>
              <Button onClick={create} loading={pending} disabled={pending}>
                Simpan &amp; lanjut
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button onClick={openNew} disabled={pending}>
          Tambah domain
        </Button>
      )}
    </div>
  );
}

/** Host + active. Two fields, because those are the two that can break reachability. */
function DomainForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  pending,
  lockHost,
}: {
  draft: DomainDraft;
  setDraft: React.Dispatch<React.SetStateAction<DomainDraft>>;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  lockHost: boolean;
}) {
  return (
    <div className="space-y-4">
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
            ? "Domain utama tidak bisa diubah — callback pembayaran & login terikat ke host ini."
            : "Harus sama persis dengan header Host. Salah satu huruf dan domain ini akan menampilkan situs utama, bukan error."}
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
