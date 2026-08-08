/**
 * "This screen is editing <host>." A statement, not a control.
 *
 * Replaces the per-screen SiteSwitcher. The screens still need to SAY which storefront
 * they write to — that is the whole risk of a panel-wide scope, editing the wrong
 * domain's hero without noticing — but they no longer each need their own way to change
 * it. One switcher, in the sidebar; six read-only reminders that point at it.
 *
 * Renders nothing when there is only one site: with nothing to confuse it with, naming
 * the site is noise on six screens.
 */
export function SiteScopeNotice({
  host,
  name,
  siteCount,
}: {
  host: string;
  name: string;
  siteCount: number;
}) {
  if (siteCount < 2) return null;

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
      <span>
        Mengatur <strong className="font-medium text-foreground">{name}</strong>{" "}
        <span className="font-mono text-foreground">{host}</span>
      </span>
      <span className="text-[var(--muted)]">
        · ganti di <strong className="font-medium text-foreground">Kelola situs</strong> pada
        sidebar
      </span>
    </p>
  );
}
