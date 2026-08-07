import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const isPanelRoute = pathname.startsWith("/panel");
  // The owner's reader. Guarded here so a signed-out visitor gets a real 307
  // before anything renders — the page streams, so a redirect thrown inside it
  // would arrive after the 200 was already committed.
  const isReadRoute = pathname.startsWith("/read/");
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");

  // Everything else skips the session lookup entirely — it costs a request to
  // Supabase, and public pages don't need it.
  if (!isPanelRoute && !isAuthRoute && !isReadRoute) {
    return NextResponse.next({ request });
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
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
