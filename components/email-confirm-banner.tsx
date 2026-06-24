"use client";

import { useFormStatus } from "react-dom";
import { resendVerification } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      size="sm"
      loading={pending}
      disabled={pending}
      className="shrink-0 px-3 text-sm border-0 bg-amber-500/20 dark:bg-amber-600/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 dark:hover:bg-amber-600/20 hover:opacity-90 disabled:opacity-70"
    >
      {pending ? "Mengirim…" : "Kirim ulang"}
    </Button>
  );
}

export function EmailConfirmBanner() {
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-2.5 bg-amber-500/15 dark:bg-amber-600/15 border-b border-amber-500/30 text-sm shrink-0"
      role="alert"
    >
      <p className="text-amber-800 dark:text-amber-200">
        Verifikasi email Anda untuk fitur lengkap. Cek inbox Anda.
      </p>
      <form action={resendVerification}>
        <ResendButton />
      </form>
    </div>
  );
}
