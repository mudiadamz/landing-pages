"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type SwitcherSite = { id: string; host: string; name: string; is_canonical: boolean };

/**
 * Picks which storefront a settings screen edits.
 *
 * The choice lives in the URL (`?site=<id>`) rather than in component state, so it
 * survives the reload the server action triggers and so a screen can be linked or
 * bookmarked per domain. Hidden entirely when there is only one site — a select
 * with one option is just noise on every settings page.
 */
export function SiteSwitcher({
  sites,
  currentId,
  label = "Domain yang diatur",
}: {
  sites: SwitcherSite[];
  currentId: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (sites.length < 2) return null;

  function pick(id: string) {
    const next = new URLSearchParams(params.toString());
    const canonical = sites.find((s) => s.is_canonical);
    // Keep the canonical site on a clean URL, so the default screen has no param.
    if (canonical && id === canonical.id) next.delete("site");
    else next.set("site", id);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  const current = sites.find((s) => s.id === currentId);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
      <div className="min-w-0">
        <label
          htmlFor="site-switcher"
          className="block text-xs font-medium text-[var(--muted)]"
        >
          {label}
        </label>
        <select
          id="site-switcher"
          value={currentId}
          disabled={pending}
          onChange={(e) => pick(e.target.value)}
          className="mt-0.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 disabled:opacity-60"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.host}
              {s.is_canonical ? " (utama)" : ""}
            </option>
          ))}
        </select>
      </div>
      <p className="min-w-0 flex-1 text-xs text-[var(--muted)]">
        {pending
          ? "Memuat…"
          : current
            ? `Perubahan di halaman ini hanya berlaku untuk ${current.host}.`
            : "Setiap domain punya pengaturannya sendiri."}
      </p>
    </div>
  );
}
