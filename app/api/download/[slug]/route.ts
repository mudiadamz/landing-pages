import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";

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
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const { data: page } = await supabase
      .from("landing_pages")
      .select("id, zip_url, title")
      .eq("slug", slug)
      .single();

    if (!page?.zip_url) {
      return NextResponse.json({ error: "File tidak tersedia" }, { status: 404 });
    }

    const { data: purchase } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("landing_page_id", page.id)
      .single();

    if (!purchase) {
      return NextResponse.json({ error: "Anda belum membeli item ini" }, { status: 403 });
    }

    const signedUrl = await getSignedDownloadUrl(page.zip_url);
    if (!signedUrl) {
      return NextResponse.json({ error: "Gagal membuat link download" }, { status: 500 });
    }

    return NextResponse.redirect(signedUrl);
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json({ error: "Gagal mengunduh" }, { status: 500 });
  }
}
