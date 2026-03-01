import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateDuitkuCallback } from "@/lib/duitku";
import { sendPurchaseConfirmationEmail } from "@/lib/email";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const merchantCode = formData.get("merchantCode") as string | null;
    const amount = formData.get("amount") as string | null;
    const merchantOrderId = formData.get("merchantOrderId") as string | null;
    const resultCode = formData.get("resultCode") as string | null;
    const reference = formData.get("reference") as string | null;
    const signature = formData.get("signature") as string | null;
    const additionalParam = formData.get("additionalParam") as string | null;

    if (!merchantCode || !amount || !merchantOrderId || !signature) {
      return NextResponse.json(
        { error: "Missing required callback parameters" },
        { status: 400 }
      );
    }

    const isValid = validateDuitkuCallback({
      merchantCode,
      amount: Number(amount),
      merchantOrderId,
      resultCode: resultCode ?? "",
      reference: reference ?? "",
      signature,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (resultCode !== "00") {
      return new NextResponse("OK", { status: 200 });
    }

    let landingPageId: string | null = null;
    let userId: string | null = null;
    let email: string | null = null;

    try {
      const parsed = additionalParam ? JSON.parse(additionalParam) : null;
      if (parsed?.lp && parsed?.u) {
        landingPageId = parsed.lp;
        userId = parsed.u;
        email = parsed.e ?? null;
      }
    } catch {
      const parts = merchantOrderId.split("-");
      if (parts[0] === "LP" && parts.length >= 4) {
        landingPageId = parts[1];
        userId = parts[2];
      }
    }

    if (!landingPageId || !userId) {
      return new NextResponse("OK", { status: 200 });
    }

    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from("purchases").insert({
        user_id: userId,
        landing_page_id: landingPageId,
      });

      if (error) {
        if (error.code === "23505") {
          return new NextResponse("OK", { status: 200 });
        }
        console.error("Duitku callback purchase insert error:", error);
      } else if (email) {
        const { data: page } = await supabase
          .from("landing_pages")
          .select("title, slug, zip_url")
          .eq("id", landingPageId)
          .single();

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        let downloadUrl = `${baseUrl}/panel`;
        if (page?.zip_url && page?.slug) {
          const signedUrl = await getSignedDownloadUrl(page.zip_url);
          if (signedUrl) {
            downloadUrl = `${baseUrl}/api/download/${page.slug}`;
          }
        }
        await sendPurchaseConfirmationEmail({
          to: email,
          title: page?.title ?? "Landing Page",
          downloadUrl,
        });
      }
    } catch (adminErr) {
      console.error("Duitku callback admin client error:", adminErr);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Duitku callback error:", err);
    return NextResponse.json(
      { error: "Callback processing failed" },
      { status: 500 }
    );
  }
}
