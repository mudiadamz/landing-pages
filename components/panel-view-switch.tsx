"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPanelView } from "@/lib/actions/panel-view";
import { useT } from "@/lib/i18n/client";
import type { PanelView } from "@/lib/panel-view";

/**
 * Switch between the shop's back office and your own account.
 *
 * Someone who runs a business also buys things, and before this their receipts
 * and favourites were only reachable because those two entries were bolted into
 * a rail built for twenty-six admin screens — which is exactly why they looked
 * out of place there. Now they live where they belong and this is the way over.
 *
 * Rendered in both shells so the trip is round: from the rail you go to your
 * account, and the account shell brings you back. A one-way door would be worse
 * than no door, because the way back would be a URL nobody was shown.
 */
export function PanelViewSwitch({ current }: { current: PanelView }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: PanelView = current === "business" ? "customer" : "business";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setPanelView(next);
          // The shell is picked in the layout, so the route has to be re-fetched
          // for the switch to be visible at all.
          router.refresh();
        })
      }
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-[var(--background)] disabled:opacity-50"
    >
      <SwitchIcon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      {next === "customer" ? t("panel.viewCustomer") : t("panel.viewBusiness")}
    </button>
  );
}

function SwitchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    </svg>
  );
}
