"use client";

import { useState, useTransition } from "react";
import { updatePromoPopup, uploadPromoImage } from "@/lib/actions/site-settings";
import { type PromoPopup } from "@/lib/promo-config";
import { PROMO_MAX_BYTES } from "@/lib/webp";
import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

export function PromoForm({ initial }: { initial: PromoPopup }) {
  const [cfg, setCfg] = useState<PromoPopup>(initial);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const set = <K extends keyof PromoPopup>(k: K, v: PromoPopup[K]) =>
    setCfg((p) => ({ ...p, [k]: v }));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadPromoImage(fd);
      if (res.ok && res.url) {
        setCfg((p) => ({
          ...p,
          imageUrl: res.url!,
          width: res.width ?? 0,
          height: res.height ?? 0,
        }));
        setMeta({ name: file.name, size: file.size });
        setMsg({ ok: true, text: `Terunggah — ${res.width}×${res.height}px. Jangan lupa Simpan.` });
      } else {
        setUploadError(res.error ?? "Gagal mengunggah.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updatePromoPopup(cfg);
      setMsg(
        res.ok
          ? { ok: true, text: "Tersimpan." }
          : { ok: false, text: res.error ?? "Gagal menyimpan." },
      );
    });
  }

  return (
    <div className="space-y-5">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
        />
        <span className="text-sm">
          <span className="font-medium text-foreground">Aktifkan popup promo</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Tampil di halaman preview produk. Tanpa gambar, popup tidak pernah muncul.
          </span>
        </span>
      </label>

      <FileUploadCard
        label="Gambar promo (WebP)"
        hint={`Wajib WebP asli, maksimal ${Math.round(PROMO_MAX_BYTES / 1024)} KB. Gambar tidak ikut dimuat saat preview dibuka — baru diambil sesaat sebelum popup tampil, jadi kecepatan preview tidak terpengaruh.`}
        accept="image/webp"
        badge="WEBP"
        badgeClass="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
        url={cfg.imageUrl}
        meta={meta}
        uploading={uploading}
        error={uploadError}
        statusText={cfg.width ? `${cfg.width}×${cfg.height} px` : "Gambar siap"}
        preview={
          cfg.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.imageUrl}
              alt=""
              className="mb-2 h-24 w-auto rounded-lg border border-[var(--border)]"
            />
          ) : null
        }
        onUpload={onFile}
        onRemove={() => {
          setCfg((p) => ({ ...p, imageUrl: "", width: 0, height: 0 }));
          setMeta(null);
          setUploadError(null);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-foreground">Link tujuan</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Kosongkan agar gambar tidak bisa diklik. Awali &quot;/&quot; untuk halaman sendiri.
          </span>
          <input
            className={`mt-1 ${input}`}
            value={cfg.href}
            onChange={(e) => set("href", e.target.value)}
            placeholder="/lp/nama-produk atau https://…"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-foreground">Teks alternatif</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Dibaca screen reader dan tampil jika gambar gagal dimuat.
          </span>
          <input
            className={`mt-1 ${input}`}
            value={cfg.alt}
            onChange={(e) => set("alt", e.target.value)}
            placeholder="Diskon 30% sampai 12.12"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-foreground">Muncul setelah (detik)</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Dihitung sejak halaman selesai dimuat. 8 detik adalah titik terakhir yang masih
            menjangkau seluruh pengunjung yang benar-benar membaca.
          </span>
          <input
            type="number"
            min={1}
            max={120}
            className={`mt-1 ${input}`}
            value={Math.round(cfg.delayMs / 1000)}
            onChange={(e) => set("delayMs", Math.round(Number(e.target.value) * 1000))}
          />
        </label>
        <label className="mt-6 flex items-start gap-2">
          <input
            type="checkbox"
            checked={cfg.exitIntent}
            onChange={(e) => set("exitIntent", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">Tampilkan saat mau keluar</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Muncul lebih awal jika kursor keluar dari atas layar. Hanya di desktop.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
