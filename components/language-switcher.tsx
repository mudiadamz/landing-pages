"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_OPTIONS } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n";

/**
 * The language control in the footer.
 *
 * Writes a cookie and refreshes rather than navigating: the choice has to
 * survive every route, and putting it in the URL would fork every link, every
 * canonical tag and every share of the site into two addresses for one page.
 *
 * `router.refresh()` re-runs the server render with the new cookie in place,
 * which is what actually swaps the language — the strings are chosen on the
 * server, so there is nothing on the client to re-translate.
 *
 * Native <select> on purpose. It is one tap on a phone, it is reachable by
 * keyboard without any work, and a footer is the last place to spend a custom
 * dropdown.
 */
export function LanguageSwitcher({
  current,
  label,
  className = "",
}: {
  current: Locale;
  /** Accessible name, translated by the caller — the footer knows the locale. */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(next: string) {
    if (next === current) return;
    // Lax, not Strict: arriving from an external link — which is how a
    // link-in-bio page is reached — must not reset the visitor's language.
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="sr-only">{label}</span>
      <GlobeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <select
        value={current}
        onChange={(e) => pick(e.target.value)}
        disabled={pending}
        aria-label={label}
        className="cursor-pointer rounded-md border-0 bg-transparent py-0.5 pr-4 text-xs text-inherit transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
      >
        {LOCALE_OPTIONS.map((o) => (
          // The option list is NOT translated: a visitor who cannot read the
          // current language needs to find their own in it.
          <option key={o.key} value={o.key} className="bg-[var(--background)] text-foreground">
            {o.native}
          </option>
        ))}
      </select>
    </label>
  );
}

function GlobeIcon({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" strokeLinecap="round" />
    </svg>
  );
}
