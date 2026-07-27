"use client";

import Link from "next/link";
import { trackCta } from "@/lib/track";

/** Short buzz on tap where supported (Android Chrome; no-op on iOS). */
function buzz() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(8);
  }
}

/**
 * The buy CTA at the end of a read — the only purchase prompt on the preview now
 * that the floating bar is gone.
 *
 * It exists as its own client component purely to keep the click analytics that
 * bar used to carry: `buy` / `buy_link` / `calendar` on the preview page feed the
 * CTA breakdown in the product stats, and dropping them would have quietly blinded
 * the next campaign report. Everything around it stays server-rendered.
 */
export function EndCtaLink({
  href,
  label,
  priceText,
  external,
  slug,
  ctaAction,
}: {
  href: string;
  label: string;
  priceText: string | null;
  /** External purchase link — open it in a new tab, as the old bar did. */
  external?: boolean;
  slug?: string;
  ctaAction?: string;
}) {
  const className =
    "flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-4 text-base font-semibold text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/20 transition-all hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]";
  const body = (
    <>
      {label}
      {priceText && <span className="opacity-80">· {priceText}</span>}
    </>
  );
  const onClick = () => {
    if (slug) trackCta(slug, "preview", ctaAction || "buy");
  };

  // An external target needs a real anchor; internal routes keep client-side nav.
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDown={buzz}
        onClick={onClick}
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={href} onPointerDown={buzz} onClick={onClick} className={className}>
      {body}
    </Link>
  );
}
