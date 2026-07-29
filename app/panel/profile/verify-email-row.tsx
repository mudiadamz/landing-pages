"use client";

import { useActionState } from "react";
import { resendVerification, type ResendState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Email verification state, inline on the profile page.
 *
 * The standing banner at the top of the panel says the same thing, but the
 * profile is where someone goes when they want to *deal* with their account —
 * finding no mention of it here, next to the address itself, reads as though the
 * banner were the only place it can be handled.
 */
export function VerifyEmailRow({ verified }: { verified: boolean }) {
  const [state, action, pending] = useActionState<ResendState, FormData>(
    resendVerification,
    null,
  );

  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Terverifikasi
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Belum diverifikasi
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <form action={action}>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={pending}
            disabled={pending}
            className="px-3 text-xs"
          >
            {pending ? "Mengirim…" : "Kirim link verifikasi"}
          </Button>
        </form>
        {state && (
          <span
            className={`text-xs ${
              state.ok ? "text-[var(--primary)]" : "text-red-600 dark:text-red-400"
            }`}
          >
            {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
