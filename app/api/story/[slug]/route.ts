import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";

// Returns a short-lived signed URL for a purchased product's story PDF.
// Gated: caller must be logged in AND own the product. The PDF viewer fetches
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
      .select("id, story_pdf_url, story_pdf_url_dark")
      .eq("slug", slug)
      .single();

    if (!page?.story_pdf_url) {
      return NextResponse.json({ error: "PDF tidak tersedia" }, { status: 404 });
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

    const signedUrl = await getSignedDownloadUrl(page.story_pdf_url);
    if (!signedUrl) {
      return NextResponse.json({ error: "Gagal membuat link PDF" }, { status: 500 });
    }

    // Optional dark-mode variant: sign it too so the reader can swap by theme.
    const signedUrlDark = page.story_pdf_url_dark
      ? await getSignedDownloadUrl(page.story_pdf_url_dark)
      : null;

    return NextResponse.json({ url: signedUrl, urlDark: signedUrlDark });
  } catch (err) {
    console.error("Story PDF error:", err);
    return NextResponse.json({ error: "Gagal memuat PDF" }, { status: 500 });
  }
}
