"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { selectPanelSite } from "@/lib/actions/sites";
import type { PanelSiteOption } from "@/lib/panel-site";

/**
 * The panel's site scope, in one place.
 *
 * Lives in the sidebar next to the profile card, so it is in the same spot on every
 * screen — including the ones it does not affect, which is the point: a control that
 * moves or disappears is a control you have to look for. Every per-site screen (Hero,
 * Konten situs, Identitas situs, Tracking, Popup, Custom JS) follows it.
 *
 * Hidden entirely with fewer than two sites. A select with one option is furniture.
 *
 * The write goes through a server action rather than document.cookie because the cookie
 * is httpOnly, and because the action is where the id gets validated and the panel
 * subtree revalidated. router.refresh() then repaints the current screen with the new
 * scope without a full navigation.
 */
export function PanelSiteSwitcher({
  sites,
  currentId,
  onChanged,
}: {
  sites: PanelSiteOption[];
  currentId: string;
  /** Closes the mobile drawer — switching is usually followed by looking at the page. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (sites.length < 2) return null;

  function pick(id: string) {
    if (id === currentId) return;
    startTransition(async () => {
      const res = await selectPanelSite(id);
      if (res.ok) {
        router.refresh();
        onChanged?.();
      }
    });
  }

  const current = sites.find((s) => s.id === currentId);

  return (
    <div className="mx-3 mt-2 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
      <label
        htmlFor="panel-site-scope"
        className="block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]"
      >
        Situs yang dikelola
      </label>
      <select
        id="panel-site-scope"
        value={currentId}
        disabled={pending}
        onChange={(e) => pick(e.target.value)}
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 disabled:opacity-60"
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.is_canonical ? " (utama)" : ""}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">
        {pending
          ? "Mengganti…"
          : current
            ? `Hero, konten, identitas, tracking, popup & custom JS berlaku untuk ${current.host}.`
            : "Setiap domain punya pengaturannya sendiri."}
      </p>
    </div>
  );
}
