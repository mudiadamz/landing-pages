"use client";

import { Suspense } from "react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { useSearchParams } from "next/navigation";

/**
 * Result of following the link in the verification email — /auth/verify-email
 * redirects here with ?verify=…
 *
 * It has to be its own strip rather than part of EmailConfirmBanner: on the one
 * outcome that matters most, success, that banner is already gone, and a
 * verification that produces no visible acknowledgement reads as one that
 * didn't work.
 */

const MESSAGES: Record<string, { ok: boolean; textKey: MessageKey }> = {
  ok: { ok: true, textKey: "auth.emailVerified" },
  expired: { ok: false, textKey: "auth.verifyExpired" },
  invalid: { ok: false, textKey: "auth.verifyInvalid" },
  error: { ok: false, textKey: "auth.verifyFailed" },
};

function Notice() {
  const t = useT();
  const status = useSearchParams().get("verify");
  const msg = status ? MESSAGES[status] : null;
  if (!msg) return null;

  return (
    <div
      className={`shrink-0 border-b px-4 py-2.5 text-sm ${
        msg.ok
          ? "border-green-500/30 bg-green-500/15 text-green-800 dark:bg-green-600/15 dark:text-green-200"
          : "border-red-500/30 bg-red-500/10 text-red-800 dark:bg-red-600/15 dark:text-red-200"
      }`}
      role="status"
    >
      {t(msg.textKey)}
    </div>
  );
}

export function EmailVerifyNotice() {
  // useSearchParams needs a boundary so it can't opt the whole panel shell out
  // of static rendering.
  return (
    <Suspense fallback={null}>
      <Notice />
    </Suspense>
  );
}
