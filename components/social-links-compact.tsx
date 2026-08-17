"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { SOCIAL_LINKS } from "@/components/social-links";

/**
 * Social links as a single row of icons — no labels.
 *
 * The labelled version (SocialLinks) is right in a footer, where there is room
 * for "Instagram" spelled out. Under a bio card it wrapped onto a second line,
 * which pushed the actual links down the screen to spell out four words everyone
 * can already read from the glyph.
 *
 * Past `maxVisible` the rest hide behind a "+N" button rather than wrapping, so
 * adding a sixth network never costs a row. With four links today nothing is
 * hidden; the control only appears once it is needed.
 */
export function SocialLinksCompact({
  className = "",
  maxVisible = 5,
  urls,
}: {
  className?: string;
  maxVisible?: number;
  /** Per-network addresses from site settings; omitted = the shipped defaults. */
  urls?: Partial<Record<(typeof SOCIAL_LINKS)[number]["key"], string>>;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  // A network with no address drops out entirely rather than linking nowhere.
  const all = SOCIAL_LINKS.map((l) => ({ ...l, href: urls?.[l.key] ?? l.href })).filter(
    (l) => !!l.href,
  );
  const overflow = all.length - maxVisible;
  const visible = expanded ? all : all.slice(0, maxVisible);

  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
      aria-label={t("home.socialLinks")}
    >
      {visible.map(({ name, href, icon, brand, brandDark }) => (
        <li key={name}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            // The name lives in aria-label, so dropping the visible text costs
            // a screen reader nothing.
            aria-label={name}
            title={name}
            // Each network's own colour, via a variable so the dark value can
            // ride the same class — an inline style cannot carry a dark variant,
            // and Threads and TikTok are black marks that vanish on a dark page.
            style={{ "--sc": brand, "--sc-dark": brandDark } as React.CSSProperties}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--sc)] transition-colors hover:bg-[var(--primary)]/15 active:scale-[0.96] dark:text-[var(--sc-dark)]"
          >
            {icon}
          </a>
        </li>
      ))}

      {overflow > 0 && !expanded && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={t("home.showMoreLinks", { count: overflow })}
            className="flex h-10 min-w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] px-2 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15 active:scale-[0.96]"
          >
            +{overflow}
          </button>
        </li>
      )}
    </ul>
  );
}
