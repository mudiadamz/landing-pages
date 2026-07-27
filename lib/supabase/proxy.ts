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

  if (!isPanelRoute && !isAuthRoute) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({
            request,
          });
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
