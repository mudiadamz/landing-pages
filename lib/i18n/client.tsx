"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, translator, type Locale, type MessageKey } from "@/lib/i18n";

/**
 * The locale, for client components.
 *
 * A module-level "current locale" would be simpler and is exactly the trap: the
 * same module runs on the server while rendering these components, where one
 * process serves every tenant at once, so a mutable global would leak one
 * visitor's language into another's response. Context is per-render, so it
 * cannot.
 *
 * Server components have no need of this — they call `requestLocale()` and pass
 * the result to `translator()` directly.
 */
const Ctx = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  return useContext(Ctx);
}

/**
 * `const t = useT();` at the top of a component, after which every call in the
 * body reads exactly as it did when there was one language.
 *
 * Falls back to the default rather than throwing when no provider is above it.
 * A missing provider should show the wrong language, not a blank screen — and
 * the panel's own language switcher makes that visible immediately.
 */
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const locale = useLocale();
  return useMemo(() => translator(locale), [locale]);
}
