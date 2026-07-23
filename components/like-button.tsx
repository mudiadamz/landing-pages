"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/actions/auth";
import { toggleLike } from "@/lib/actions/likes";
import { trackCta, type TrackPage } from "@/lib/track";

type Props = {
  pageId: string;
  slug: string;
  page: TrackPage;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
  /** "floating" = pill (preview overlay); "inline" = bordered button (checkout). */
  variant?: "floating" | "inline";
};

/**
 * Login-gated "like" (heart) with a running count. Logged-out visitors get a
 * button that starts Google sign-in and returns to this page; once signed in the
 * heart toggles the like optimistically via the toggleLike server action.
 */
export function LikeButton({
  pageId,
  slug,
  page,
  initialLiked,
  initialCount,
  isLoggedIn,
  variant = "inline",
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const nextPath = page === "checkout" ? `/checkout/${slug}` : `/lp/${slug}`;

  const base =
    "inline-flex items-center gap-1.5 text-sm font-medium transition-all active:scale-95 touch-manipulation";
  const shell =
    variant === "floating"
      ? "rounded-xl border border-[var(--border)]/50 bg-[var(--card)]/60 px-3 py-1.5 shadow-md backdrop-blur"
      : "rounded-xl border border-[var(--border)] px-4 py-2 hover:bg-[var(--background)]";
  const tone = liked ? "text-red-500" : "text-[var(--muted)] hover:text-foreground";
  const cls = `${base} ${shell} ${tone}`;

  // Logged out → the heart is a submit that kicks off Google sign-in.
  if (!isLoggedIn) {
    return (
      <form action={signInWithGoogle} className={variant === "floating" ? "" : "w-fit"}>
        <input type="hidden" name="next" value={nextPath} />
        <button type="submit" className={cls} title="Masuk untuk menyukai" aria-label="Suka">
          <HeartIcon filled={false} className="h-4 w-4" />
          <span>Suka{count > 0 ? ` · ${count}` : ""}</span>
        </button>
      </form>
    );
  }

  async function onClick() {
    if (pending) return;
    setPending(true);
    const next = !liked;
    // Optimistic.
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    trackCta(slug, page, next ? "like" : "unlike");
    try {
      const res = await toggleLike(pageId);
      if (res.ok) {
        setLiked(res.liked);
        setCount(res.count);
      } else {
        // Session lost — revert.
        setLiked(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    } catch {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "Batalkan suka" : "Suka"}
      title={liked ? "Batalkan suka" : "Suka"}
      className={`${cls} disabled:opacity-60`}
    >
      <HeartIcon filled={liked} className="h-4 w-4" />
      <span>{liked ? "Disukai" : "Suka"}{count > 0 ? ` · ${count}` : ""}</span>
    </button>
  );
}

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}
