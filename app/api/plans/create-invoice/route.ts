import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDuitkuInvoice } from "@/lib/duitku";
import { getPlanMeta, getPlanPrices } from "@/lib/actions/site-settings";
import { canonicalOrigin, currentOrigin, currentSiteId } from "@/lib/site-resolve";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { isPurchasable, normalizePlan, resolvePlanMeta, visiblePlanKeys, type PaidPlanKey } from "@/lib/plans";

/**
 * Buy a plan for a month (or several).
 *
 * The product flow's twin — same gateway, same two-origin rule — with one
 * difference that matters: an order row is written HERE, before the buyer is
 * sent to Duitku, and `merchant_order_id` is what the callback looks the payment
 * up by. The product flow can rebuild everything it needs from the ids inside
 * that string, because a product purchase is "this person owns this thing". A
 * plan is "this person owns this thing UNTIL a date", and the date depends on
 * what was bought and when — so it is recorded at the point where it is known,
 * not reconstructed later from a 50-character id.
 *
 * The row also makes the callback idempotent for free: `merchant_order_id` is
 * UNIQUE, and a redelivered callback settles an order that is already settled.
 */

/** How many months may be bought in one go. Beyond this it is a conversation. */
const MAX_MONTHS = 24;

export async function POST(req: NextRequest) {
  const [supabase, locale] = await Promise.all([createClient(), requestLocale()]);
  const t = translator(locale);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("chat.signInRequired") }, { status: 401 });

  const email = user.email?.trim();
  if (!email) return NextResponse.json({ error: t("plan.noEmail") }, { status: 400 });

  let body: { plan?: string; months?: number };
  try {
    body = (await req.json()) as { plan?: string; months?: number };
  } catch {
    return NextResponse.json({ error: t("chat.badRequest") }, { status: 400 });
  }

  const plan = normalizePlan(body.plan);
  // normalizePlan turns anything unknown into `free`, which is not for sale — so
  // this one check covers a typo, a stale page and a hand-crafted request alike.
  const months = Math.min(Math.max(Math.floor(Number(body.months) || 1), 1), MAX_MONTHS);

  const prices = await getPlanPrices();
  // Priced AND shown. Hiding a tier has to close the checkout too, or it is a
  // tier that is merely hard to find: this endpoint takes a plan key straight
  // from the request body, so a stale tab or a hand-written POST would otherwise
  // still buy something this storefront has stopped offering.
  const meta = await getPlanMeta();
  if (!isPurchasable(plan, prices) || !visiblePlanKeys(meta).includes(plan)) {
    return NextResponse.json({ error: t("plan.notPurchasable") }, { status: 400 });
  }

  const perMonth = prices[plan as PaidPlanKey];
  const amount = perMonth * months;
  const siteId = await currentSiteId();

  // Unique per attempt, not per user+plan: somebody renewing next month must get a
  // new order rather than colliding with the one they paid last month.
  const noDash = (s: string) => s.replace(/-/g, "");
  const merchantOrderId = `PL_${noDash(user.id)}_${Date.now().toString(36)}`.slice(0, 50);

  // Service-role: the buyer may read their own orders but must not be able to
  // write one — "paid" has to be something Duitku said, not something a browser
  // claimed. The auth check above is this call's gate (invariant I6).
  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("lp_plan_orders")
    .insert({
      user_id: user.id,
      site_id: siteId || null,
      plan,
      months,
      amount,
      merchant_order_id: merchantOrderId,
      status: "pending",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[plans] gagal membuat order:", orderError);
    return NextResponse.json({ error: t("plan.orderFailed") }, { status: 500 });
  }

  // The storefront's name for the tier, not the shipped one: this string is
  // what the buyer sees on the Duitku page and on their invoice.
  const label = `${resolvePlanMeta(plan, meta).label} — ${months} bulan`;
  const fullName = (user.user_metadata?.full_name as string) ?? email;
  const firstName = fullName.split(" ")[0] || "Customer";
  const lastName = fullName.split(" ").slice(1).join(" ") || "";
  const phoneNumber = ((user.user_metadata?.phone as string) ?? "").trim();

  try {
    const result = await createDuitkuInvoice({
      paymentAmount: amount,
      merchantOrderId,
      productDetails: label,
      email,
      phoneNumber,
      customerVaName: fullName,
      itemDetails: [{ name: label, price: amount, quantity: 1 }],
      customerDetail: {
        firstName,
        lastName,
        email,
        phoneNumber,
        billingAddress: {
          firstName,
          lastName,
          address: "Indonesia",
          city: "Jakarta",
          postalCode: "00000",
          phone: phoneNumber,
          countryCode: "ID",
        },
        shippingAddress: {
          firstName,
          lastName,
          address: "Indonesia",
          city: "Jakarta",
          postalCode: "00000",
          phone: phoneNumber,
          countryCode: "ID",
        },
      },
      // Same split as the product flow: the callback is server-to-server so it
      // pins to the canonical host, the buyer comes back to the storefront they
      // were actually on.
      callbackUrl: `${canonicalOrigin()}/api/duitku/callback`,
      returnUrl: `${await currentOrigin()}/upgrade?order=${order.id}`,
      expiryPeriod: 60,
    });

    return NextResponse.json({ paymentUrl: result.paymentUrl, reference: result.reference });
  } catch (err) {
    // The order stays `pending` rather than being deleted: an invoice that failed
    // to open is worth seeing in the panel, and a row nobody can pay for is
    // harmless — the plan only moves when a callback says it was paid.
    console.error("[plans] Duitku menolak:", err);
    return NextResponse.json({ error: t("checkout.invoiceFailed") }, { status: 500 });
  }
}
