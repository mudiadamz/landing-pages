"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Cloudflare Turnstile, rendered explicitly and reported through a hidden input
 * so a plain Server Action form picks the token up as ordinary form data.
 *
 * Explicit render rather than Turnstile's automatic `.cf-turnstile` scan: the
 * script scans the DOM once on load, which races React's mount and leaves an
 * empty box on a client-side navigation into /signup. Rendering by hand ties the
 * widget's life to the component's.
 *
 * The script is fetched lazily, after the form is already interactive, so a
 * third-party request can never sit in front of the page paint.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | undefined;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** One shared load, however many widgets ask for it. */
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      // Let a later mount retry rather than caching the failure forever.
      scriptPromise = null;
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({ siteKey, field }: { siteKey: string; field: string }) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return;
        idRef.current =
          window.turnstile.render(boxRef.current, {
            sitekey: siteKey,
            theme: "auto",
            size: "flexible",
            // Shows up in the Turnstile dashboard, so signup traffic can be told
            // apart from anything else that gets a widget later.
            action: "signup",
            callback: (t: string) => setToken(t),
            // Tokens are single-use and expire after ~5 minutes; clearing on
            // expiry means a stale one is never submitted.
            "expired-callback": () => setToken(""),
            "timeout-callback": () => setToken(""),
            "error-callback": () => {
              setToken("");
              setBroken(true);
            },
          }) ?? null;
      })
      .catch(() => {
        if (!cancelled) setBroken(true);
      });

    return () => {
      cancelled = true;
      if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current);
      idRef.current = null;
    };
  }, [siteKey]);

  return (
    <div>
      <div ref={boxRef} className="flex justify-center empty:hidden" />
      <input type="hidden" name={field} value={token} readOnly />
      {broken && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {t("auth.turnstileFailed")}
        </p>
      )}
    </div>
  );
}
