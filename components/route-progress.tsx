"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

const EVENT_NAME = "next-route-progress-start";

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
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const startedRef = useRef(false);

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

  // 2) On "start" event: show bar and set initial progress
  useEffect(() => {
    function onStart() {
      startedRef.current = true;
      setVisible(true);
      setProgress(25);
    }
    window.addEventListener(EVENT_NAME, onStart);
    return () => window.removeEventListener(EVENT_NAME, onStart);
  }, []);

  // 3) When pathname changes: complete progress then hide
  useEffect(() => {
    if (!pathname) return;
    if (startedRef.current) {
      setProgress(100);
      const t = setTimeout(() => {
        setVisible(false);
        setProgress(0);
        startedRef.current = false;
      }, 200);
      return () => clearTimeout(t);
    }
  }, [pathname]);

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
        className="h-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
