"use client";

import { useState } from "react";
import { EpubQuickForm } from "./epub-quick-form";
import { NewPageForm } from "./new-page-form";
import type { LandingPageCategory } from "@/lib/actions/landing-pages";
import { useT } from "@/lib/i18n/client";

/**
 * Two ways to start a product, with the short one first.
 *
 * The long form is the general case and stays exactly as it was. The EPUB form
 * exists because a book already answers most of what the long form asks, and
 * making a seller retype the title of a file they just uploaded is work the
 * computer should be doing.
 *
 * A tab rather than a separate route: this is one decision — "is it a book?" —
 * and it does not deserve a page of its own to navigate back out of.
 */
export function NewProductModeTabs({ categories }: { categories: LandingPageCategory[] }) {
  const t = useT();
  const [mode, setMode] = useState<"epub" | "full">("epub");

  const tab = (key: "epub" | "full", label: string, sub: string) => {
    const active = mode === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setMode(key)}
        aria-pressed={active}
        className={`flex-1 rounded-xl px-4 py-3 text-left transition-colors ${
          active
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "bg-[var(--accent-subtle)] text-foreground hover:bg-[var(--primary)]/15"
        }`}
      >
        <span className="block text-sm font-semibold">{label}</span>
        <span className={`mt-0.5 block text-xs ${active ? "opacity-80" : "text-[var(--muted)]"}`}>
          {sub}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        {tab("epub", t("panel.modeEpub"), t("panel.modeEpubSub"))}
        {tab("full", t("home.otherLinks"), t("panel.modeFullSub"))}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        {mode === "epub" ? (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">{t("panel.fromEpubFile")}</h2>
              <p className="text-sm text-[var(--muted)]">
                {t("panel.fromEpubIntro")}
              </p>
            </div>
            <EpubQuickForm categories={categories} />
          </>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">{t("panel.basicInfo")}</h2>
              <p className="text-sm text-[var(--muted)]">
                {t("panel.basicInfoIntro")}
              </p>
            </div>
            <NewPageForm categories={categories} />
          </>
        )}
      </div>
    </div>
  );
}
