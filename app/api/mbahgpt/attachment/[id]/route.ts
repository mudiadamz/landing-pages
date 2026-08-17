import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_TYPES } from "@/lib/mbahgpt/messages";

/**
 * Serve one chat attachment.
 *
 * The bucket is private, so this route is the only way in: it reads the row (RLS
 * scopes that to the owner), then signs a short-lived URL and redirects. Same
 * shape as the paid-download route — the check is a database row, not a guess
 * about the URL.
 *
 * Images are served inline so they render in the transcript; everything else is
 * forced as a download, exactly as the standalone server did. A stored document
 * that the browser is willing to interpret AS a document is how an uploaded .html
 * turns into a page running on this origin.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Masuk dulu." }, { status: 401 });

  const { data: attachment } = await supabase
    .from("lp_chat_attachments")
    .select("name, mime, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!attachment) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });

  const inline = IMAGE_TYPES.has(attachment.mime);
  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrl(attachment.storage_path, 60 * 60, {
      // The filename is sanitised because it lands in a Content-Disposition
      // header: a quote or a newline there is a header-injection attempt.
      ...(inline ? {} : { download: attachment.name.replace(/[^\w.\- ]/g, "_") }),
    });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Berkas tidak tersedia." }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl);
}
