"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PANEL_VIEW_COOKIE, normalizePanelView } from "@/lib/panel-view";

/**
 * Remember which panel this person wants to look at.
 *
 * No permission gate, on purpose: the cookie is a PREFERENCE, and the layout
 * refuses to honour a business view for someone with no business capabilities
 * (resolvePanelView). So the worst a forged value can do is show its sender the
 * shell they were already entitled to.
 *
 * A year, because it is a preference and not a session — someone who works in
 * the customer view should not be put back in the admin rail every time their
 * session rolls over.
 */
export async function setPanelView(value: string): Promise<void> {
  const view = normalizePanelView(value);
  if (!view) return;
  (await cookies()).set(PANEL_VIEW_COOKIE, view, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  // The shell is chosen in the panel LAYOUT, so the whole subtree has to be
  // re-rendered — revalidating the page alone leaves the old rail in place.
  revalidatePath("/panel", "layout");
}
