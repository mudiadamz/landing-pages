import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";
import { extractEpubChapters } from "@/lib/epub-server";

/**
 * Chapter markup for a product's EPUB **deliverable**, for someone who owns it.
 *
 * Deliberately separate from /api/epub-text: that one serves the free preview
 * and is cached at the edge for everyone, so it must never vary by viewer. This
 * response depends on who is asking, so it is private and never stored —
 * otherwise a buyer's full book could be cached and handed to strangers.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Anda harus login" }, { status: 401 });

    const { data: page } = await db
      .from("lp_landing_pages")
      .select("id, story_epub_url, user_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!page?.story_epub_url) {
      return NextResponse.json({ error: "EPUB tidak tersedia" }, { status: 404 });
    }

    // The seller can always read their own product; everyone else must have bought it.
    if (page.user_id !== user.id) {
      const { data: purchase } = await db
        .from("lp_purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("landing_page_id", page.id)
        .maybeSingle();
      if (!purchase) {
        return NextResponse.json({ error: "Anda belum membeli item ini" }, { status: 403 });
      }
    }

    const url = await getSignedDownloadUrl(page.story_epub_url);
    if (!url) return NextResponse.json({ error: "Gagal membuat link" }, { status: 500 });

    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    const bytes = new Uint8Array(await res.arrayBuffer());

    // Images are served by the public asset route, which only exposes files the
    // preview already shows. Anything it can't resolve simply won't render.
    const { chapters } = extractEpubChapters(
      bytes,
      (path) => `/api/epub-asset/${encodeURIComponent(slug)}?p=${encodeURIComponent(path)}`,
    );

    return NextResponse.json(
      { chapters },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unreadable EPUB" }, { status: 500 });
  }
}
