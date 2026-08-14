"use client";

import { useState, useTransition } from "react";
import { updatePopupBanner, uploadPopupImage } from "@/lib/actions/site-settings";
import { type PopupBanner } from "@/lib/popup-config";
import { POPUP_MAX_BYTES } from "@/lib/webp";
import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";
import { useT } from "@/lib/i18n/client";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

export function PopupForm({ initial, siteId }: { initial: PopupBanner; siteId: string }) {
  const t = useT();
  const [cfg, setCfg] = useState<PopupBanner>(initial);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const set = <K extends keyof PopupBanner>(k: K, v: PopupBanner[K]) =>
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
      const res = await uploadPopupImage(fd);
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
      const res = await updatePopupBanner(cfg, siteId);
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
          <span className="font-medium text-foreground">{t("panel.popupEnable")}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {t("panel.popupEnableHint")}
          </span>
        </span>
      </label>

      <FileUploadCard
        label={t("panel.popupImage")}
        hint={`Opsional — tanpa gambar, popup memakai ilustrasi hujan + bunga bawaan (nol request). Kalau diisi: wajib WebP asli, maksimal ${Math.round(POPUP_MAX_BYTES / 1024)} KB.`}
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
          <span className="text-xs font-medium text-foreground">{t("panel.popupHref")}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Kosongkan agar gambar tidak bisa diklik. Awali &quot;/&quot; untuk halaman sendiri.
          </span>
          <input
            className={`mt-1 ${input}`}
            value={cfg.href}
            onChange={(e) => set("href", e.target.value)}
            placeholder={t("panel.popupHrefPlaceholder")}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-foreground">{t("panel.popupAlt")}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {t("panel.popupAltHint")}
          </span>
          <input
            className={`mt-1 ${input}`}
            value={cfg.alt}
            onChange={(e) => set("alt", e.target.value)}
            placeholder={t("panel.popupAltPlaceholder")}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-foreground">{t("panel.popupDelay")}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {t("panel.popupDelayHint")}
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
            <span className="font-medium text-foreground">{t("panel.popupExit")}</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              {t("panel.popupExitHint")}
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <p className="text-xs font-medium text-foreground">{t("panel.popupBody")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Eyebrow</span>
            <input className={`mt-1 ${input}`} value={cfg.eyebrow}
              onChange={(e) => set("eyebrow", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Judul</span>
            <input className={`mt-1 ${input}`} value={cfg.title}
              onChange={(e) => set("title", e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="text-xs text-[var(--muted)]">Teks</span>
          <textarea rows={3} className={`mt-1 resize-y ${input}`} value={cfg.body}
            onChange={(e) => set("body", e.target.value)} />
        </label>

        <label className="flex items-start gap-2">
          <input type="checkbox" checked={cfg.emailCapture}
            onChange={(e) => set("emailCapture", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span className="text-sm">
            <span className="font-medium text-foreground">{t("panel.popupAskEmail")}</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Alamat disimpan di <code>lp_promo_subscribers</code>. Kalau dimatikan, tombol
              memakai &quot;Link tujuan&quot; di atas.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--muted)]">{t("panel.popupButtonLabel")}</span>
            <input className={`mt-1 ${input}`} value={cfg.ctaLabel}
              onChange={(e) => set("ctaLabel", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">{t("panel.popupDismissLabel")}</span>
            <input className={`mt-1 ${input}`} value={cfg.dismissLabel}
              onChange={(e) => set("dismissLabel", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">{t("panel.popupInstagramUrl")}</span>
            <input className={`mt-1 ${input}`} value={cfg.instagramUrl}
              onChange={(e) => set("instagramUrl", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">{t("panel.popupInstagramLabel")}</span>
            <input className={`mt-1 ${input}`} value={cfg.instagramLabel}
              onChange={(e) => set("instagramLabel", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">{t("panel.popupThanksTitle")}</span>
            <input className={`mt-1 ${input}`} value={cfg.doneTitle}
              onChange={(e) => set("doneTitle", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">{t("panel.popupThanksBody")}</span>
            <input className={`mt-1 ${input}`} value={cfg.doneBody}
              onChange={(e) => set("doneBody", e.target.value)} />
          </label>
        </div>
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
