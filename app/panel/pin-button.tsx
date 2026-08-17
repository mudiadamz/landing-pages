"use client";

import { useState, useTransition } from "react";
import { setLandingPageFeatured } from "@/lib/actions/landing-pages";
import { useT } from "@/lib/i18n/client";

export function PinButton({ id, featured, size = "sm" }: { id: string; featured: boolean; size?: "sm" | "lg" }) {
  const t = useT();
  const [pinned, setPinned] = useState(featured);
  const [pending, startTransition] = useTransition();
  const shape = size === "lg" ? "h-11 flex-1 border border-[var(--border)] active:scale-95" : "p-2 active:scale-90";

  function toggle() {
    const next = !pinned;
    setPinned(next); // optimistic
    startTransition(async () => {
      try {
        await setLandingPageFeatured(id, next);
      } catch {
        setPinned(!next); // revert on failure
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={pinned}
      title={pinned ? t("panel.unpin") : t("panel.pinToFront")}
      aria-label={pinned ? t("panel.unpin") : t("panel.pinToFront")}
      className={`inline-flex items-center justify-center rounded-lg transition disabled:opacity-50 hover:bg-[var(--background)] ${shape} ${
        pinned ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-foreground"
      }`}
    >
      <svg
        className={size === "lg" ? "w-5 h-5" : "w-4 h-4"}
        viewBox="0 0 24 24"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.585 10.8c-.783-.57-.38-1.81.588-1.81h4.915a1 1 0 00.95-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
}
