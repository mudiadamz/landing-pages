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
 * The language control: a flag and a three-letter code per language.
 *
 * Both, not either. A flag alone is ambiguous — 🇬🇧 is a country, and plenty of
 * languages are spoken in several — while a bare code is unreadable at a glance.
 * Together they are recognisable at footer size without a dropdown to open.
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

  function pick(next: Locale) {
    if (next === current) return;
    remember(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 rounded-lg border border-[var(--border)] p-0.5 ${className}`}
    >
      {LOCALE_OPTIONS.map((o) => {
        const active = o.key === current;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => pick(o.key)}
            disabled={pending}
            aria-pressed={active}
            // The full language name in its own script: someone who cannot read
            // the current language still needs to identify their own.
            title={o.native}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold leading-none tracking-wide transition-colors disabled:opacity-50 ${
              active
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted)] hover:bg-[var(--accent-subtle)] hover:text-foreground"
            }`}
          >
            {/* Emoji, so it inherits the text colour of neither state and needs
                no asset. Windows renders these as letter pairs rather than a
                flag, which is why the code is beside it rather than behind a
                tooltip. */}
            <span aria-hidden className="text-[13px] leading-none">
              {o.flag}
            </span>
            {o.code}
            <span className="sr-only"> — {o.native}</span>
          </button>
        );
      })}
    </div>
  );
}
