import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createDuitkuInvoice } from "@/lib/duitku";
import { getLandingPageForCheckout } from "@/lib/actions/landing-pages";
import { isSoldOut, isUpcoming } from "@/lib/product-status";
import { normalizeProductType } from "@/lib/product-type";
import { normalizeShipping, shippingColumns, shippingProblems } from "@/lib/shipping";
import { canonicalOrigin, currentOrigin, currentSiteId } from "@/lib/site-resolve";

export async function POST(req: NextRequest) {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { slug, shipping: shippingInput } = body as { slug: string; shipping?: unknown };

    if (!slug) {
      return NextResponse.json(
        { error: "slug wajib diisi" },
        { status: 400 }
      );
    }

    const email = user.email?.trim();
    if (!email) {
      return NextResponse.json(
        { error: "Akun belum memiliki email. Perbarui profil Anda." },
        { status: 400 }
      );
    }

    const phoneNumber = (user.user_metadata?.phone as string)?.trim() ?? undefined;

    const page = await getLandingPageForCheckout(slug);
    if (!page) {
      return NextResponse.json({ error: "Landing page tidak ditemukan" }, { status: 404 });
    }

    // Scheduled-upcoming products can't be bought yet (owner excepted).
    if (isUpcoming(page.available_at, page.user_id === user.id)) {
      return NextResponse.json(
        { error: "Produk ini belum tersedia untuk dibeli." },
        { status: 403 }
      );
    }

    // Sold out is refused HERE, before an invoice exists. The trigger behind
    // the purchase insert clamps at zero instead of refusing, on purpose: by
    // the time the callback runs the money has already moved, and a refusal
    // there would mean a buyer who paid for nothing (20260924010000).
    if (isSoldOut(page)) {
      return NextResponse.json({ error: "Stok produk ini sudah habis." }, { status: 409 });
    }

    /**
     * The address, parked until the callback can attach it to a purchase row.
     *
     * The row that records a PAID purchase is written server-to-server by
     * Duitku's callback, which has no form and no session — so the address the
     * buyer just typed has to wait somewhere it can be found by (user,
     * product). Deliberately not inside additionalParam: that field goes to
     * Duitku, and a home address is not theirs to hold.
     */
    const needsAddress = normalizeProductType(page.product_type) === "physical";
    const shipping = normalizeShipping(shippingInput);
    if (needsAddress) {
      const missing = shippingProblems(shipping);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Alamat pengiriman belum lengkap.", missing },
          { status: 400 },
        );
      }
      await db.from("lp_pending_shipping").upsert(
        {
          user_id: user.id,
          landing_page_id: page.id,
          ...shippingColumns(shipping!),
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,landing_page_id" },
      );
      // Sweep this buyer's own abandoned checkouts while we are here — a
      // cleanup that rides an existing path cannot silently stop running the
      // way a forgotten cron does.
      await db
        .from("lp_pending_shipping")
        .delete()
        .eq("user_id", user.id)
        .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
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

    // Two different origins on purpose.
    //
    // callbackUrl is server-to-server: Duitku posts the payment result to it with
    // no browser involved, so it must be ONE fixed host we control regardless of
    // which storefront the buyer started from — otherwise every new niche domain
    // silently becomes a payment endpoint that has to be whitelisted.
    //
    // returnUrl is where the BUYER's browser lands afterwards, so it has to be the
    // domain they were shopping on. Sending them to admuiux.com after they bought
    // on a niche site looks like a redirect to a stranger's shop.
    const callbackBase = canonicalOrigin();
    const returnBase = await currentOrigin();
    const noDash = (s: string) => s.replace(/-/g, "");
    const merchantOrderId = `LP_${noDash(page.id)}_${noDash(user.id)}`.slice(0, 50);
    // The callback arrives server-to-server on the CANONICAL host, so it cannot work
    // out which storefront the buyer was on — it has to be told, and additionalParam is
    // the only channel Duitku hands back.
    //
    // That field is capped at 255 chars, and a truncated string is not valid JSON: the
    // callback would fail to parse it, fall back to merchantOrderId, and lose the email
    // AND the site. So fields are dropped in reverse order of importance until it fits,
    // rather than sliced blindly the way this used to be.
    const siteId = await currentSiteId();
    const candidates: Record<string, string>[] = [
      { lp: page.id, u: user.id, s: siteId, e: email.trim() },
      { lp: page.id, u: user.id, s: siteId },
      { lp: page.id, u: user.id },
    ];
    const packed = candidates.map((c) => JSON.stringify(c));
    const additionalParam = packed.find((c) => c.length <= 255) ?? packed[2];

    const fullName = user.user_metadata?.full_name ?? user.email ?? "Customer";
    const firstName = fullName.split(" ")[0] || "Customer";
    const lastName = fullName.split(" ").slice(1).join(" ") || "";
    // Duitku's customerDetail is required and used to fill its own forms, so it
    // has always been sent a placeholder. Now that a physical order carries a
    // real address, send that instead — but only the one the buyer gave FOR
    // this delivery, and only when there is one. Nothing else gains an address
    // it did not have.
    const ship = needsAddress ? shipping : null;
    const address = ship?.address || "Indonesia";
    const city = ship?.city || "Jakarta";
    const postalCode = ship?.postalCode || "00000";
    const shipPhone = ship?.phone || phoneNumber || "";

    const result = await createDuitkuInvoice({
      paymentAmount,
      merchantOrderId,
      productDetails: page.title,
      email,
      phoneNumber: phoneNumber ?? "",
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
        email,
        phoneNumber: phoneNumber ?? "",
        billingAddress: {
          firstName,
          lastName,
          address,
          city,
          postalCode,
          phone: shipPhone,
          countryCode: "ID",
        },
        shippingAddress: {
          firstName: ship?.name?.split(" ")[0] || firstName,
          lastName: ship?.name?.split(" ").slice(1).join(" ") || lastName,
          address,
          city,
          postalCode,
          phone: shipPhone,
          countryCode: "ID",
        },
      },
      additionalParam,
      callbackUrl: `${callbackBase}/api/duitku/callback`,
      returnUrl: `${returnBase}/checkout/${slug}/done`,
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
