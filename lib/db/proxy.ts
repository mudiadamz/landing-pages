import { safeNextPath } from "@/lib/next-path";
import { NextResponse, type NextRequest } from "next/server";
import { isMissingRecord } from "@/lib/missing-record";
import { sessionFailureReason, sessionFingerprint, validateSession } from "@/lib/backend/auth";
import { sessionTokenFrom } from "@/lib/auth/cookie";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/" && request.nextUrl.searchParams.has("category")) {
    const slug = request.nextUrl.searchParams.get("category")?.trim();
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/category/${slug}`;
      url.searchParams.delete("category");
      return NextResponse.redirect(url, 301);
    }
  }

  /**
   * A missing record answered with a REAL 404, before the response starts.
   *
   * `notFound()` inside a page renders the right body under a 200, because by
   * the time it runs the response is already streaming and the status is spent.
   * A rewrite from here carries a status, so this is the only layer that can
   * answer honestly. Costs one cached, time-limited, fail-open lookup on the
   * paths that can actually miss.
   */
  if (await isMissingRecord(pathname, request.headers.get("host") ?? "")) {
    return NextResponse.rewrite(new URL("/not-found-page", request.url), { status: 404 });
  }

  /**
   * Forward the pathname to the server components.
   *
   * A layout never receives it, and app/panel/layout.tsx has to tell a customer
   * route ("Pembelian saya") from an admin one to decide whether a niche domain
   * may serve it.
   */
  const nextWithPath = () => {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers } });
  };

  const isPanelRoute = pathname.startsWith("/panel");
  // The owner's reader. Guarded here so a signed-out visitor gets a real 307
  // before anything renders — the page streams, so a redirect thrown inside it
  // would arrive after the 200 was already committed.
  const isReadRoute = pathname.startsWith("/read/");
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");

  // Everything else skips the session lookup entirely — public pages that want
  // the user ask for it themselves, and most don't.
  if (!isPanelRoute && !isAuthRoute && !isReadRoute) {
    // Still carries x-pathname: the session lookup is what public pages skip,
    // not the header. The root layout reads it to know whether it is rendering
    // the homepage, and returning a bare next() here left it blank on "/" — the
    // one route that asked.
    return nextWithPath();
  }

  // One indexed lookup in app_auth.sessions. Nothing to refresh: the session is
  // opaque and its expiry slides server-side, so the cookie is never rewritten
  // here — and a revoked or banned session stops working on this very request.
  const token = sessionTokenFrom((n) => request.cookies.get(n)?.value);
  const user = await validateSession(token);

  if ((isPanelRoute || isReadRoute) && !user) {
    /**
     * Say WHY, once per bounce. Every cause of "logged out again" produces this
     * identical redirect, so without a reason the complaint cannot be answered:
     * a cookie the browser dropped and a session the server expired look exactly
     * the same from the outside. One extra query, only on the failing path.
     */
    const reason = await sessionFailureReason(token);
    console.warn(
      `[auth] bounce to /login reason=${reason} path=${pathname} session=${sessionFingerprint(token)} ua=${(request.headers.get("user-agent") ?? "-").slice(0, 80)}`,
    );
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Come back to the book after signing in.
    if (isReadRoute) url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    // Already signed in, so there is nothing to sign in to — but honour where the
    // link said to go afterwards. Without this, arriving at /login?next=/ with a
    // live session (a stale tab, a back button) lands on the panel, which is the
    // one place the caller explicitly said not to send them.
    const url = request.nextUrl.clone();
    const next = safeNextPath(url.searchParams.get("next"));
    url.pathname = next ?? "/panel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return nextWithPath();
}
