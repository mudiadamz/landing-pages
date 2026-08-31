/**
 * Which surfaces the Tawk launcher must stay off.
 *
 * Pure and in lib/ rather than inside the component, because it is the part with
 * actual decisions in it: the component around it only talks to a third-party
 * script that cannot be unit-tested here.
 */
export function isTawkHidden(pathname: string | null, fullscreenHome: boolean): boolean {
  if (!pathname) return false;
  // The admin panel, and the full-bleed product preview.
  //
  // `/preview`, not `/lp`: the preview route moved (next.config.ts still 308s the
  // old path) and this check was left pointing at the old one — so the bubble had
  // been sitting on top of every product preview since the move.
  if (pathname === "/panel" || pathname.startsWith("/panel/")) return true;
  if (pathname === "/preview" || pathname.startsWith("/preview/")) return true;
  // The chat template's homepage is a full-viewport app that owns the bottom edge
  // of the screen; the launcher lands on its send button. Whether the template has
  // such a homepage is passed in — only lib/templates/registry knows that.
  return fullscreenHome && pathname === "/";
}
