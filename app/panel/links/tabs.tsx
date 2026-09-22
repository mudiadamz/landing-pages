"use client";

import { useState } from "react";
import { SocialForm } from "./social-form";
import { LinksForm } from "./links-form";
import { Tabs } from "@/components/ui/tabs";
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
  siteId,
  socialUrls,
  otherLinks,
}: {
  /** Situs yang sedang difilter. */
  siteId: string;
  socialUrls: SocialUrls;
  otherLinks: OtherLink[];
}) {
  const t = useT();
  const [tab, setTab] = useState<"social" | "other">("social");

  return (
    <div className="space-y-5">
      <Tabs
        items={[
          { key: "social", label: t("panel.tabSocial") },
          { key: "other", label: t("panel.tabOther") },
        ]}
        active={tab}
        onChange={(k) => setTab(k as "social" | "other")}
        ariaLabel={t("panel.navLinks")}
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        {tab === "social" ? (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">{t("panel.tabSocial")}</h2>
              <p className="text-sm text-[var(--muted)]">
                {t("panel.tabSocialIntro")}
              </p>
            </div>
            <SocialForm siteId={siteId} initial={socialUrls} />
          </>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">{t("panel.tabOther")}</h2>
              <p className="text-sm text-[var(--muted)]">
                {t("panel.tabOtherIntro")}
              </p>
            </div>
            <LinksForm siteId={siteId} initial={otherLinks} />
          </>
        )}
      </div>
    </div>
  );
}
