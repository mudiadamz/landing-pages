import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";

// Returns a short-lived signed URL for a purchased product's EPUB deliverable.
// Gated: caller must be logged in AND own the product. The EPUB reader fetches
// this endpoint, then loads the returned (signed) URL directly.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Anda harus login" }, { status: 401 });
    }

    const { data: page } = await db
      .from("lp_landing_pages")
      .select("id, story_epub_url")
      .eq("slug", slug)
      .single();

    if (!page?.story_epub_url) {
      return NextResponse.json({ error: "EPUB tidak tersedia" }, { status: 404 });
    }

    const { data: purchase } = await db
      .from("lp_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("landing_page_id", page.id)
      .single();

    if (!purchase) {
      return NextResponse.json({ error: "Anda belum membeli item ini" }, { status: 403 });
    }

    const signedUrl = await getSignedDownloadUrl(page.story_epub_url);
    if (!signedUrl) {
      return NextResponse.json({ error: "Gagal membuat link EPUB" }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error("Story EPUB error:", err);
    return NextResponse.json({ error: "Gagal memuat EPUB" }, { status: 500 });
  }
}
