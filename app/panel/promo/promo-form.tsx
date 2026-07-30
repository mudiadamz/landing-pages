"use client";

import { useRef, useState, useTransition } from "react";
import { updatePromoPopup, uploadPromoImage } from "@/lib/actions/site-settings";
import { type PromoPopup } from "@/lib/promo-config";
import { PROMO_MAX_BYTES } from "@/lib/webp";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

export function PromoForm({ initial }: { initial: PromoPopup }) {
  const [cfg, setCfg] = useState<PromoPopup>(initial);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof PromoPopup>(k: K, v: PromoPopup[K]) =>
    setCfg((p) => ({ ...p, [k]: v }));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
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
        setMsg({ ok: true, text: `Terunggah — ${res.width}×${res.height}px. Jangan lupa Simpan.` });
      } else {
        setMsg({ ok: false, text: res.error ?? "Gagal mengunggah." });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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

      <div>
        <p className="text-xs font-medium text-foreground">Gambar promo (WebP)</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Wajib WebP asli, maksimal {Math.round(PROMO_MAX_BYTES / 1024)} KB. Gambar tidak
          ikut dimuat saat preview dibuka — baru diambil sesaat sebelum popup tampil,
          jadi kecepatan preview tidak terpengaruh.
        </p>

        {cfg.imageUrl && (
          <div className="mt-2 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cfg.imageUrl}
              alt=""
              className="h-24 w-auto rounded-lg border border-[var(--border)]"
            />
            <div className="min-w-0 text-xs text-[var(--muted)]">
              <p>
                {cfg.width || "?"}×{cfg.height || "?"} px
              </p>
              <p className="mt-1 break-all">{cfg.imageUrl}</p>
              <button
                type="button"
                onClick={() => setCfg((p) => ({ ...p, imageUrl: "", width: 0, height: 0 }))}
                className="mt-1 text-red-600 hover:underline"
              >
                Hapus gambar
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/webp"
          onChange={onFile}
          disabled={uploading}
          className="mt-2 block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        {uploading && <p className="mt-1 text-xs text-[var(--muted)]">Mengunggah…</p>}
      </div>

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
