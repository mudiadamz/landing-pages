"use client";

import { useState, useTransition } from "react";
import { setLandingPagePublished } from "@/lib/actions/landing-pages";

/**
 * Quick action to show/hide a product. Hidden products drop out of the public
 * homepage listing and 404 for visitors on /lp/[slug] & /checkout/[slug].
 */
export function VisibilityToggle({ id, published, size = "sm" }: { id: string; published: boolean; size?: "sm" | "lg" }) {
  const [visible, setVisible] = useState(published);
  const [pending, startTransition] = useTransition();
  const shape = size === "lg" ? "h-11 flex-1 border border-[var(--border)] active:scale-95" : "p-2 active:scale-90";
  const iconClass = size === "lg" ? "w-5 h-5" : "w-4 h-4";

  function toggle() {
    const next = !visible;
    const ok = confirm(
      next
        ? "Tampilkan produk ini di frontend? Produk akan muncul di homepage & bisa diakses pengunjung."
        : "Sembunyikan produk ini dari frontend? Produk akan hilang dari homepage & tidak bisa diakses pengunjung.",
    );
    if (!ok) return;
    setVisible(next); // optimistic
    startTransition(async () => {
      try {
        await setLandingPagePublished(id, next);
      } catch {
        setVisible(!next); // revert on failure
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={visible}
      title={visible ? "Sembunyikan dari frontend" : "Tampilkan di frontend"}
      aria-label={visible ? "Sembunyikan dari frontend" : "Tampilkan di frontend"}
      className={`inline-flex items-center justify-center rounded-lg transition disabled:opacity-50 hover:bg-[var(--background)] ${shape} ${
        visible ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-foreground"
      }`}
    >
      {visible ? (
        <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ) : (
        <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      )}
    </button>
  );
}
