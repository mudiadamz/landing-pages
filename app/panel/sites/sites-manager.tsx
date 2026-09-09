"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSite, updateSiteDomain, deleteSite, selectPanelSite } from "@/lib/actions/sites";
// Type-only, so nothing from site-resolve (which reads headers()) reaches the client.
import type { Site } from "@/lib/site-resolve";
import { DomainSetupGuide } from "./domain-setup-guide";
import { useT } from "@/lib/i18n/client";

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
  templateLabels,
  paletteLabels,
}: {
  sites: Site[];
  canonicalHost: string;
  supabaseProjectUrl: string;
  /** key -> label, so the summary line can name the template without the registry. */
  templateLabels: Record<string, string>;
  paletteLabels: Record<string, string>;
}) {
  const t = useT();
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

  /** Point the whole panel at this site, then open its identity screen. */
  function manage(siteId: string) {
    startTransition(async () => {
      const res = await selectPanelSite(siteId);
      if (!res.ok) {
        setMessage({ type: "err", text: res.error ?? t("sites.switchFailed") });
        return;
      }
      router.push("/panel/branding");
    });
  }

  function saveDomain(id: string) {
    startTransition(async () => {
      const res = await updateSiteDomain(id, draft);
      if (!res.ok) {
        setMessage({ type: "err", text: res.error ?? t("common.failed") });
        return;
      }
      setMessage({ type: "ok", text: t("sites.domainSaved") });
      setEditing(null);
      router.refresh();
    });
  }

  function create() {
    startTransition(async () => {
      const res = await createSite(newDraft);
      if (!res.ok) {
        setMessage({ type: "err", text: res.error ?? t("common.failed") });
        return;
      }
      // Barisnya ada; sisanya DNS. Tidak ada langkah "daftarkan ke penyedia"
      // lagi — Caddy menerbitkan sertifikatnya sendiri begitu domainnya menunjuk
      // ke server ini (lihat app/api/tls-check).
      const vercelNote = t("sites.pointDnsNext");
      setMessage({
        type: "ok",
        text: t("sites.domainAdded", { host: newDraft.host, note: vercelNote }),
      });
      setEditing(null);
      router.refresh();
      // Straight to the half that is still empty. A fresh domain has default name,
      // template and palette, and leaving the admin on this screen hides that. Point
      // the panel scope at it first, or the identity screen would open on whichever
      // site the sidebar was already showing.
      if (res.id) {
        await selectPanelSite(res.id);
        router.push("/panel/branding");
      }
    });
  }

  function remove(site: Site) {
    if (
      !confirm(t("sites.deleteConfirm", { host: site.host }))
    )
      return;
    startTransition(async () => {
      const res = await deleteSite(site.id);
      setMessage(
        res.ok
          ? { type: "ok", text: t("sites.domainDeleted", { host: site.host }) }
          : { type: "err", text: res.error ?? t("common.deleteFailed") },
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
        <p className="font-medium text-foreground">{t("sites.threePlaces")}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-[var(--muted)]">
          <li>
            <strong className="text-foreground">{t("sites.placeHere")}</strong>{" "}
            {t("sites.placeHereWhat")}
          </li>
          <li>
            <strong className="text-foreground">DNS</strong> {t("sites.placeDnsWhat")}
          </li>
          <li>
            <strong className="text-foreground">Supabase</strong> {t("sites.placeSupabaseWhat")}
          </li>
        </ol>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {t("sites.identityLivesIn")}{" "}
          <strong className="text-foreground">{t("sites.identity")}</strong>{" "}
          {t("sites.identityNotHere")}{" "}
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
                      <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--primary)]">
                        {t("sites.canonicalBadge")}
                      </span>
                    )}
                    {!site.active && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-600 dark:text-amber-400">
                        {t("sites.inactive")}
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
                  {/* A button, not a Link: the scope is a cookie now, so jumping to
                      another site's identity screen means SETTING the scope first.
                      A plain href would land on whichever site the sidebar is
                      pointing at — the row you clicked and the screen you got would
                      disagree. */}
                  <button
                    type="button"
                    onClick={() => manage(site.id)}
                    disabled={pending}
                    className="mt-1.5 inline-block text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
                  >
                    Identitas &amp; tampilan →
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(site)}>
                    {t("sites.editDomain")}
                  </Button>
                  {!site.is_canonical && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => remove(site)}
                      disabled={pending}
                    >
                      {t("common.delete")}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {editing !== site.id && !site.is_canonical && (
              <div className="mt-3 space-y-2">
                <DomainSetupGuide
                  host={site.host}
                  supabaseProjectUrl={supabaseProjectUrl}
                  canonicalHost={canonicalHost}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Add */}
      {editing === "new" ? (
        <div className={CARD}>
          <h2 className="mb-1 text-sm font-semibold text-foreground">{t("sites.newDomain")}</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            {t("sites.newDomainIntro")}
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
                  placeholder={t("sites.hostPlaceholder")}
                  className={`${INPUT} font-mono`}
                />
                <p className="text-xs text-[var(--muted)]">
                  {t("sites.hostHint")}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  {t("sites.siteName")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDraft.name}
                  onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder={t("sites.namePlaceholder")}
                  className={INPUT}
                />
                <p className="text-xs text-[var(--muted)]">{t("sites.changeableLater")}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button onClick={create} loading={pending} disabled={pending}>
                {t("sites.saveAndNext")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button onClick={openNew} disabled={pending}>
          {t("sites.addDomain")}
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
  const t = useT();
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
          placeholder={t("sites.hostPlaceholder")}
          disabled={lockHost}
          className={`${INPUT} font-mono disabled:opacity-60`}
        />
        <p className="text-xs text-[var(--muted)]">
          {lockHost
            ? t("sites.canonicalHostLocked")
            : t("sites.hostExactHint")}
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
          <span className="block text-sm font-medium text-foreground">{t("sites.active")}</span>
          <span className="block text-xs text-[var(--muted)]">
            {t("sites.inactiveHint")}
          </span>
        </span>
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={onSave} loading={pending} disabled={pending}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
