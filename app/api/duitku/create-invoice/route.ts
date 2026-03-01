import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDuitkuInvoice } from "@/lib/duitku";
import { getLandingPageForCheckout } from "@/lib/actions/landing-pages";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { slug, email, phoneNumber } = body as {
      slug: string;
      email: string;
      phoneNumber?: string;
    };

    if (!slug || !email?.trim()) {
      return NextResponse.json(
        { error: "slug dan email wajib diisi" },
        { status: 400 }
      );
    }

    const page = await getLandingPageForCheckout(slug);
    if (!page) {
      return NextResponse.json({ error: "Landing page tidak ditemukan" }, { status: 404 });
    }

    const isFree = page.is_free === true;
    const price = page.price ?? 0;
    const priceDiscount = page.price_discount ?? 0;
    const hasDiscount = !isFree && priceDiscount > 0;
    const paymentAmount = Math.round(hasDiscount ? priceDiscount : price);

    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: "Item ini gratis, gunakan tombol Ambil gratis" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const shortId = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const merchantOrderId = `LP-${shortId}`.slice(0, 50);
    const additionalParam = JSON.stringify({
      lp: page.id,
      u: user.id,
    }).slice(0, 255);

    const fullName = user.user_metadata?.full_name ?? user.email ?? "Customer";
    const firstName = fullName.split(" ")[0] || "Customer";
    const lastName = fullName.split(" ").slice(1).join(" ") || "";
    const address = "Indonesia";

    const result = await createDuitkuInvoice({
      paymentAmount,
      merchantOrderId,
      productDetails: page.title,
      email: email.trim(),
      phoneNumber: phoneNumber?.trim(),
      customerVaName: fullName,
      itemDetails: [
        {
          name: page.title,
          price: paymentAmount,
          quantity: 1,
        },
      ],
      customerDetail: {
        firstName,
        lastName,
        email: email.trim(),
        phoneNumber: phoneNumber?.trim() ?? "",
        billingAddress: {
          firstName,
          lastName,
          address,
          city: "Jakarta",
          postalCode: "00000",
          phone: phoneNumber?.trim() ?? "",
          countryCode: "ID",
        },
        shippingAddress: {
          firstName,
          lastName,
          address,
          city: "Jakarta",
          postalCode: "00000",
          phone: phoneNumber?.trim() ?? "",
          countryCode: "ID",
        },
      },
      additionalParam,
      callbackUrl: `${baseUrl}/api/duitku/callback`,
      returnUrl: `${baseUrl}/checkout/${slug}/done`,
      expiryPeriod: 60,
    });

    return NextResponse.json({
      paymentUrl: result.paymentUrl,
      reference: result.reference,
    });
  } catch (err) {
    console.error("Duitku create invoice error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat invoice" },
      { status: 500 }
    );
  }
}
