import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";

// Returns a short-lived signed URL for a purchased product's story PDF.
// Gated: caller must be logged in AND own the product. The PDF viewer fetches
// this endpoint, then loads the returned URL directly from Supabase Storage.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Anda harus login" }, { status: 401 });
    }

    const { data: page } = await supabase
      .from("lp_landing_pages")
      .select("id, story_pdf_url")
      .eq("slug", slug)
      .single();

    if (!page?.story_pdf_url) {
      return NextResponse.json({ error: "PDF tidak tersedia" }, { status: 404 });
    }

    const { data: purchase } = await supabase
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

    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error("Story PDF error:", err);
    return NextResponse.json({ error: "Gagal memuat PDF" }, { status: 500 });
  }
}
