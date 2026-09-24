import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";
import { deliversFile, normalizeProductType } from "@/lib/product-type";

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
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const { data: page } = await db
      .from("lp_landing_pages")
      .select("id, zip_url, title, product_type")
      .eq("slug", slug)
      .single();

    // Asked of the PRODUCT's kind, never of the order's status: a physical
    // order marked done still has no file, and a digital purchase has one
    // while its status says pending (20260924000000).
    if (page && !deliversFile(normalizeProductType(page.product_type))) {
      return NextResponse.json(
        { error: "Produk ini tidak dikirim sebagai file." },
        { status: 404 },
      );
    }

    if (!page?.zip_url) {
      return NextResponse.json({ error: "File tidak tersedia" }, { status: 404 });
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
