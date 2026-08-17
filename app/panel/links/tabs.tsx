"use client";

import { useState } from "react";
import { SocialForm } from "./social-form";
import { LinksForm } from "./links-form";
import type { OtherLink } from "@/lib/actions/site-settings";
import type { SocialUrls } from "@/lib/social";
import { useT } from "@/lib/i18n/client";

/**
 * Two lists that both answer "where else can I find you", so they share a screen
 * rather than two nav entries — but they are edited differently enough to want
 * separate tabs: the social one is four fixed networks, the other is a list you
 * add rows to.
 */
export function LinksTabs({
  socialUrls,
  otherLinks,
}: {
  socialUrls: SocialUrls;
  otherLinks: OtherLink[];
}) {
  const t = useT();
  const [tab, setTab] = useState<"social" | "other">("social");

  const button = (key: "social" | "other", label: string, sub: string) => {
    const active = tab === key;
    return (
      <button
        type="button"
        onClick={() => setTab(key)}
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
        {button("social", t("panel.tabSocial"), t("panel.tabSocialSub"))}
        {button("other", t("panel.tabOther"), t("panel.tabOtherSub"))}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        {tab === "social" ? (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">{t("panel.tabSocial")}</h2>
              <p className="text-sm text-[var(--muted)]">
                {t("panel.tabSocialIntro")}
              </p>
            </div>
            <SocialForm initial={socialUrls} />
          </>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">{t("panel.tabOther")}</h2>
              <p className="text-sm text-[var(--muted)]">
                Situs lain milik Anda — toko lain, portfolio, newsletter. Muncul lewat
                ikon link di samping ikon media sosial.
              </p>
            </div>
            <LinksForm initial={otherLinks} />
          </>
        )}
      </div>
    </div>
  );
}
