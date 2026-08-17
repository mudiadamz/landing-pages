import Link from "next/link";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/**
 * The header every panel screen opens with: back, title, an optional identifier,
 * and optional actions.
 *
 * One component because eighteen screens had grown their own copy of it, and on
 * a phone the copies stacked four rows deep — back, then title, then the slug,
 * then a row of buttons — before any of the form appeared. Here back and title
 * share a line and the actions sit on it, so the same information costs one row
 * plus an optional second.
 *
 * "Kembali" is hidden below sm and the arrow carries it, with the label kept for
 * screen readers. The word is the widest part of the row and the one that says
 * least: an arrow at the top-left of a subpage is already understood, and every
 * pixel it takes is a pixel the title truncates by.
 */
export async function PanelPageHeader({
  backHref,
  /** Defaults to "Kembali" in the caller's locale. */
  backLabel,
  title,
  /** A slug or id, rendered in mono under the title. */
  identifier,
  /** A sentence under the title. Use one or the other, not both. */
  description,
  actions,
}: {
  backHref: string;
  backLabel?: string;
  title: string;
  identifier?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const t = translator(await requestLocale());
  const back = backLabel ?? t("common.back");
  return (
    <header className="flex flex-col gap-2">
      {/* flex-wrap, so a pair of icon buttons stays on the title's line while a
          whole filter bar (see /panel/analytics) drops to its own — without each
          screen having to decide which it is. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        <Link
          href={backHref}
          // -ml-2 pulls the padding back out to the page edge, so the row starts
          // where the title would have without giving up the 44px touch target.
          className="-ml-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
        >
          <span aria-hidden>←</span>
          <span className="sr-only sm:not-sr-only">{back}</span>
        </Link>

        <h1 className="min-w-[6rem] flex-1 truncate text-lg font-semibold tracking-tight sm:text-xl">
          {title}
        </h1>

        {actions && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5 sm:gap-2">{actions}</div>
        )}
      </div>

      {identifier && (
        <span className="w-fit max-w-full truncate rounded bg-[var(--background)] px-2 py-1 font-mono text-xs text-[var(--muted)] sm:text-sm">
          {identifier}
        </span>
      )}
      {description && !identifier && (
        <p className="text-sm text-[var(--muted)]">{description}</p>
      )}
    </header>
  );
}
