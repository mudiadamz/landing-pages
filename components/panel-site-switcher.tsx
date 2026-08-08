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

  /*
   * One row: a small label and the select. No card, no explanatory paragraph.
   *
   * It used to be a bordered box sitting directly under the bordered profile card, with
   * three lines listing every screen the scope affected — roughly 150px of sidebar for a
   * single choice, and two adjacent boxes competing to look like the header.
   *
   * The paragraph is deleted rather than shortened, for two reasons. It had already gone
   * stale: it named six screens, but the scope now also covers products, sales, analytics
   * and contacts — and any list kept here will drift again the next time. And the
   * information belongs where it is actionable: every scoped screen states its own scope,
   * on the screen where getting it wrong would cost something. The sidebar's job is to
   * hold the control, not to explain it.
   */
  return (
    <div className="mx-3 mt-2.5 shrink-0">
      <label
        htmlFor="panel-site-scope"
        className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]"
      >
        Kelola situs
      </label>
      <select
        id="panel-site-scope"
        value={currentId}
        disabled={pending}
        // On hover, the host — which the option text omits when a site's name and its
        // domain are not the same string.
        title={current ? `Layar per-domain berlaku untuk ${current.host}` : undefined}
        onChange={(e) => pick(e.target.value)}
        className="w-full truncate rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 disabled:opacity-50"
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.is_canonical ? " (utama)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
