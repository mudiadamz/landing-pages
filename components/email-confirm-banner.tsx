"use client";

import { useFormStatus } from "react-dom";
import { resendVerification } from "@/lib/actions/auth";

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 dark:bg-amber-600/20 text-amber-800 dark:text-amber-200 font-medium hover:opacity-90 transition-opacity disabled:opacity-70"
    >
      {pending ? "Mengirim…" : "Kirim ulang"}
    </button>
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
