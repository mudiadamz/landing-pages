"use client";

import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

/**
 * The only interactive part of the Pustaka header.
 *
 * A plain pair of links rather than a dropdown: there are two destinations, and a
 * menu that has to be opened to reveal two items is worse than showing both. Sign
 * out is a form so it stays a POST to the server action.
 */
export function PustakaUserMenu({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[var(--card)]"
      >
        Masuk
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/panel/purchases"
        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[var(--card)]"
      >
        Bacaan saya
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg px-2 py-1.5 text-sm text-[var(--muted)] transition-colors hover:text-foreground"
        >
          Keluar
        </button>
      </form>
    </div>
  );
}
