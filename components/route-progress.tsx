"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";

const EVENT_NAME = "next-route-progress-start";
const MIN_STEP1_MS = 400; // Minimum visible time for step 1 (0→25%)

function isSameOrigin(href: string): boolean {
  if (href.startsWith("/")) return true;
  try {
    return new URL(href).origin === (typeof window !== "undefined" ? window.location.origin : "");
  } catch {
    return false;
  }
}

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const startedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // 1) Show bar immediately on link click or form submit (capture phase)
  useEffect(() => {
    function startProgress() {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    }
    function getPathFromHref(href: string): string {
      const path = href.startsWith("/") ? href : new URL(href, window.location.origin).pathname;
      return path.split("?")[0].split("#")[0] || "/";
    }
    function handleClick(e: MouseEvent) {
      const target = (e.target as Element).closest("a");
      if (!target || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const href = target.getAttribute("href");
      if (!href || target.target === "_blank" || target.hasAttribute("download")) return;
      if (!isSameOrigin(href)) return;
      if (pathname && getPathFromHref(href) === pathname) return;
      startProgress();
    }
    function handleSubmit() {
      startProgress();
    }
    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [pathname]);

  // 2) On "start" event: show bar and animate to 25% (slower step 1)
  useEffect(() => {
    function onStart() {
      startedRef.current = true;
      startTimeRef.current = Date.now();
      setVisible(true);
      setProgress(0);
      setTimeout(() => setProgress(25), 80);
    }
    window.addEventListener(EVENT_NAME, onStart);
    return () => window.removeEventListener(EVENT_NAME, onStart);
  }, []);

  // 3) When pathname or searchParams changes: ensure min step1 time, then complete and hide
  useEffect(() => {
    if (!pathname) return;
    if (!startedRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    const wait = Math.max(0, MIN_STEP1_MS - elapsed);
    const t = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
        startedRef.current = false;
      }, 200);
    }, wait);
    return () => clearTimeout(t);
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-1 overflow-hidden"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Memuat halaman"
    >
      <div
        className="h-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
