"use client";

import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { resendVerification, type ResendState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Standing "verify your email" notice at the top of the panel.
 *
 * Not dismissible, and shown on every panel page for as long as the address is
 * unproven. Signup stopped waiting for verification so that a new customer
 * isn't sent to their inbox mid-purchase — which means this banner is the only
 * thing still asking, and a nag that could be closed would simply never be
 * answered.
 *
 * The address is spelled out because the most common reason verification never
 * lands is a typo at signup, and the reader can't fix what they can't see.
 */
export function EmailConfirmBanner({ email }: { email: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<ResendState, FormData>(
    resendVerification,
    null,
  );

  return (
    <div
      className="shrink-0 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-sm dark:bg-amber-600/15"
      role="alert"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="min-w-0 text-amber-800 dark:text-amber-200">
          {t("auth.emailNotVerified")}
          {email && (
            <>
              {" — "}
              <span className="font-medium break-all">{email}</span>
            </>
          )}
          . Cek inbox (dan folder spam) untuk link verifikasinya.
        </p>
        <form action={action} className="shrink-0">
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={pending}
            disabled={pending}
            className="shrink-0 border-0 bg-amber-500/20 px-3 text-sm text-amber-800 hover:bg-amber-500/20 hover:opacity-90 disabled:opacity-70 dark:bg-amber-600/20 dark:text-amber-200 dark:hover:bg-amber-600/20"
          >
            {pending ? "Mengirim…" : t("auth.resend")}
          </Button>
        </form>
      </div>
      {state && (
        <p
          className={`mt-1 text-xs ${
            state.ok
              ? "text-amber-800 dark:text-amber-200"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
