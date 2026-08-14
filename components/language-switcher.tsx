"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_OPTIONS } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n";

/**
 * Outside the component on purpose: writing document.cookie is a mutation of
 * something React does not own, and the compiler's immutability rule rejects it
 * in component scope. It is also simply not component logic.
 *
 * Lax, not Strict: arriving from an external link — which is how a link-in-bio
 * page is reached — must not reset the visitor's language.
 */
function remember(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * The language control: a dropdown showing a flag and a three-letter code.
 *
 * Both marks, not either. A flag alone is ambiguous — plenty of languages are
 * spoken in several countries — and a bare code is unreadable at a glance.
 * Windows renders regional-indicator pairs as letters rather than a flag, which
 * is a second reason the code sits beside it rather than behind a tooltip.
 *
 * A native <select>, not a custom menu: one tap on a phone, the platform's own
 * picker, keyboard and screen-reader support for free, and no way to leave it
 * hanging open across a route change. The collapsed control shows only the
 * current language, which is the point of a dropdown in a footer and a sidebar —
 * a row of buttons grows with every language added.
 *
 * Picking a language writes a cookie and calls `router.refresh()`, which re-runs
 * the server render with the new cookie. The strings are chosen on the server,
 * so there is nothing on the client to re-translate. The same cookie drives the
 * storefront and the panel, which is why switching in one changes the other.
 *
 * Cookie rather than a URL segment: the choice has to survive every route, and
 * putting it in the path would fork every link, canonical tag and share of the
 * site into two addresses for one page.
 */
export function LanguageSwitcher({
  current,
  label,
  className = "",
}: {
  current: Locale;
  /** Accessible name, translated by the caller — the caller knows the locale. */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const shown = LOCALE_OPTIONS.find((o) => o.key === current) ?? LOCALE_OPTIONS[0];

  function pick(next: string) {
    if (next === current) return;
    remember(next as Locale);
    startTransition(() => router.refresh());
  }

  return (
    <span
      className={`relative inline-flex items-center rounded-lg border border-[var(--border)] text-[11px] font-semibold leading-none tracking-wide transition-colors focus-within:ring-2 focus-within:ring-[var(--ring)] hover:bg-[var(--accent-subtle)] ${className}`}
    >
      {/* Transparent and stretched over the whole control. The native select
          draws its own arrow, padding and font on every platform; the visible
          face below is ours, and this stays the REAL control rather than a
          decoration with a click handler bolted onto it. */}
      <select
        value={current}
        onChange={(e) => pick(e.target.value)}
        disabled={pending}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      >
        {LOCALE_OPTIONS.map((o) => (
          // The native name, in its own language: someone who cannot read the
          // current language still has to identify their own in the list.
          <option key={o.key} value={o.key}>
            {o.flag} {o.code} — {o.native}
          </option>
        ))}
      </select>

      <span aria-hidden className={`flex items-center gap-1.5 px-2 py-1 ${pending ? "opacity-50" : ""}`}>
        <span className="text-[13px] leading-none">{shown.flag}</span>
        {shown.code}
        <ChevronIcon className="h-3 w-3 opacity-60" />
      </span>
    </span>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}
