"use client";

/**
 * Icon-only copy button, one per code block and one per answer.
 *
 * Two things it must get right, both learned the hard way in the standalone app:
 *
 *   * `navigator.clipboard` needs a secure context. It is there on the deployed
 *     site, but not on a plain-http LAN address during development — so there is
 *     an `execCommand` fallback, and a failure is REPORTED rather than silently
 *     doing nothing.
 *   * The label lives in the tooltip and the accessible name, not next to the
 *     icon: the button sits on top of the text it copies, and a worded button
 *     competes with it.
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

type State = "idle" | "done" | "failed";

export function CopyButton({
  getText,
  label,
  className = "",
}: {
  /** Read at click time: the answer is still growing while it streams. */
  getText: () => string;
  label: string;
  className?: string;
}) {
  const t = useT();
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Every timer is cleared on unmount. Switching chats mid-stream unmounts these
  // by the dozen, and a callback firing into a gone component is a warning at
  // best and a leak at worst.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const title = state === "done" ? t("chat.copied") : state === "failed" ? t("chat.copyFailed") : label;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await writeClipboard(getText() || "");
        setState(ok ? "done" : "failed");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 1600);
      }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border bg-[var(--card)] transition-colors ${
        state === "done"
          ? "border-[var(--primary)] text-[var(--primary)]"
          : state === "failed"
            ? "border-red-500 text-red-500"
            : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-foreground"
      } ${className}`}
    >
      {state === "done" ? <CheckIcon /> : state === "failed" ? <CrossIcon /> : <CopyIcon />}
    </button>
  );
}

/**
 * The code-block variant, which knows its own label.
 *
 * Markdown blocks are assembled by plain functions (see markdown.tsx), and a
 * plain function cannot call a hook — so the one string that variant needs is
 * resolved here, in a component, rather than threaded through every level of the
 * block parser as an argument.
 */
export function CopyCodeButton({ getText, className }: { getText: () => string; className?: string }) {
  const t = useT();
  return <CopyButton getText={getText} label={t("chat.copyCode")} className={className} />;
}

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-[15px] w-[15px]",
};

function CopyIcon() {
  return (
    <svg {...stroke}>
      <path d="M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...stroke}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg {...stroke}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
