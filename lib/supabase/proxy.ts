import { safeNextPath } from "@/lib/next-path";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isMissingRecord } from "@/lib/missing-record";

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
   * may serve it. Built fresh at each call rather than snapshotted once, because
   * Supabase rewrites request cookies during the session refresh below and a
   * stale copy would drop the renewed session.
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

  // Everything else skips the session lookup entirely — it costs a request to
  // Supabase, and public pages don't need it.
  if (!isPanelRoute && !isAuthRoute && !isReadRoute) {
    // Still carries x-pathname: the session lookup is what public pages skip,
    // not the header. The root layout reads it to know whether it is rendering
    // the homepage, and returning a bare next() here left it blank on "/" — the
    // one route that asked.
    return nextWithPath();
  }

  let supabaseResponse = nextWithPath();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = nextWithPath();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if ((isPanelRoute || isReadRoute) && !user) {
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

  return supabaseResponse;
}
