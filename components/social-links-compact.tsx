"use client";

import { useState } from "react";
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
}: {
  className?: string;
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const overflow = SOCIAL_LINKS.length - maxVisible;
  const visible = expanded ? SOCIAL_LINKS : SOCIAL_LINKS.slice(0, maxVisible);

  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
      aria-label="Tautan media sosial"
    >
      {visible.map(({ name, href, icon }) => (
        <li key={name}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            // The name lives in aria-label, so dropping the visible text costs
            // a screen reader nothing.
            aria-label={name}
            title={name}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15 active:scale-[0.96]"
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
            aria-label={`Tampilkan ${overflow} tautan lainnya`}
            className="flex h-10 min-w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] px-2 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15 active:scale-[0.96]"
          >
            +{overflow}
          </button>
        </li>
      )}
    </ul>
  );
}
