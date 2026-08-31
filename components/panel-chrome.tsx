"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AssetLibraryModal } from "@/components/asset-library-modal";
import { sidebarCookie } from "@/lib/panel-chrome";

/**
 * Shared state for the panel shell.
 *
 * The sidebar and the topbar are siblings in two different corners of the
 * layout — the drawer is `fixed`, the topbar sits inside the content pane — but
 * they drive each other: the topbar's button opens the drawer and collapses the
 * rail, and the sidebar has to render at the width that button chose. Lifting it
 * to a context is what lets each stay where it belongs in the DOM instead of one
 * of them being positioned into the other's corner.
 */
type PanelChromeValue = {
  /** Desktop rail state. Ignored below md, where the sidebar is a drawer. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  closeMobile: () => void;
  openAssets: () => void;
};

const PanelChromeContext = createContext<PanelChromeValue | null>(null);

export function usePanelChrome(): PanelChromeValue {
  const value = useContext(PanelChromeContext);
  if (!value) throw new Error("usePanelChrome must be used inside <PanelChrome>");
  return value;
}

/**
 * Outside the component: writing document.cookie mutates something React does
 * not own, which the compiler's immutability rule rejects in component scope.
 * Same pattern as components/language-switcher.tsx.
 */
function remember(collapsed: boolean) {
  document.cookie = sidebarCookie(collapsed);
}

export function PanelChrome({
  defaultCollapsed,
  children,
}: {
  /** From the cookie, read server-side — so the first paint is already right. */
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      remember(next);
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Escape closes the drawer, and the page behind it stops scrolling while it is
  // open — without that, dragging the drawer scrolls the content underneath and
  // you return to a page that has moved.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      closeMobile,
      openAssets: () => setAssetsOpen(true),
    }),
    [collapsed, toggleCollapsed, mobileOpen, closeMobile],
  );

  return (
    <PanelChromeContext.Provider value={value}>
      {children}
      {/* One instance for the whole panel: the asset library is opened from a nav
          row, and a modal rendered inside the sidebar would be unmounted with the
          drawer on mobile the moment it opened. */}
      <AssetLibraryModal open={assetsOpen} onClose={() => setAssetsOpen(false)} />
    </PanelChromeContext.Provider>
  );
}
