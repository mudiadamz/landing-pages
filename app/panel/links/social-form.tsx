"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SOCIAL_LINKS } from "@/components/social-links";
import { updateSocialUrls } from "@/lib/actions/site-settings";
import type { SocialUrls } from "@/lib/social";
import { useT } from "@/lib/i18n/client";

/**
 * The address per network. Only the address.
 *
 * The glyph and the brand colour stay in code, so this is four text fields and
 * not an icon picker: nobody should be able to point the Instagram mark at a
 * YouTube channel, and a storefront gains nothing from choosing its own logo for
 * somebody else's network.
 *
 * Clearing a field removes that icon from the site — which is the only way a
 * storefront without a TikTok stops showing one.
 */
export function SocialForm({ initial, siteId }: { initial: SocialUrls; siteId: string }) {
  const t = useT();
  const [urls, setUrls] = useState<SocialUrls>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);
    const res = await updateSocialUrls(urls, siteId);
    setSaving(false);
    if (res.ok) setStatus(t("common.saved"));
    else setError(res.error ?? t("common.failed"));
  }

  return (
    <div className="space-y-4">
      {SOCIAL_LINKS.map(({ key, name, icon, brand, brandDark }) => (
        <div key={key}>
          <label htmlFor={`social-${key}`} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
            <span
              style={{ "--sc": brand, "--sc-dark": brandDark } as React.CSSProperties}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--sc)] dark:text-[var(--sc-dark)]"
            >
              {icon}
            </span>
            {name}
          </label>
          <input
            id={`social-${key}`}
            value={urls[key]}
            onChange={(e) => {
              setUrls((u) => ({ ...u, [key]: e.target.value }));
              setStatus(null);
            }}
            placeholder={`https://…  (kosongkan untuk sembunyikan ${name})`}
            inputMode="url"
            maxLength={500}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="md" onClick={save} disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
        {status && <span className="text-sm text-green-600 dark:text-green-400">{status}</span>}
        {error && <span className="text-sm text-red-500 dark:text-red-400">{error}</span>}
      </div>

      <p className="text-xs text-[var(--muted)]">
        Hanya <span className="font-mono">http://</span> atau{" "}
        <span className="font-mono">https://</span> yang disimpan. Field kosong = ikon
        jaringan itu tidak ditampilkan di situs.
      </p>
    </div>
  );
}
