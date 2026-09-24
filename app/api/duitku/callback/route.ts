import { NextRequest, NextResponse } from "next/server";
import { ensureSiteMembership } from "@/lib/actions/profiles";
import { createAdminClient } from "@/lib/db/admin";
import { recordSale } from "@/lib/ledger";
import { grantBundleItems } from "@/lib/bundle";
import { validateDuitkuCallback } from "@/lib/duitku";
import { sendPurchaseConfirmationEmail } from "@/lib/email";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";
import { generateInvoiceNumber } from "@/lib/invoice";
import { sendMetaPurchaseEvent } from "@/lib/meta-capi";
import { effectivePlan } from "@/lib/plans";
import { deliversFile, initialFulfillment, normalizeProductType } from "@/lib/product-type";

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

    // A plan, not a product. Told apart by the id this route made itself, and
    // handled separately because the two grant different things: a product is
    // access to a file forever, a plan is a capability until a date.
    if (merchantOrderId.startsWith("PL_")) {
      await settlePlanOrder(merchantOrderId);
      return new NextResponse("OK", { status: 200 });
    }

    let landingPageId: string | null = null;
    let userId: string | null = null;
    let email: string | null = null;
    // Which storefront the buyer paid on. Only ever available here via additionalParam —
    // the request's own host is the canonical domain, which would credit every niche
    // sale to the main site. Absent (old invoices, truncated param) means unattributed,
    // which the panel reads as canonical.
    let siteId: string | null = null;

    if (additionalParam) {
      try {
        const parsed = JSON.parse(additionalParam);
        if (parsed?.lp && parsed?.u) {
          landingPageId = parsed.lp;
          userId = parsed.u;
          email = parsed.e ?? null;
          siteId = typeof parsed.s === "string" && parsed.s ? parsed.s : null;
        }
      } catch {
        // additionalParam was not valid JSON, fall through to merchantOrderId parsing
      }
    }

    if (!landingPageId || !userId) {
      const parts = merchantOrderId.split("_");
      if (parts[0] === "LP" && parts.length >= 3 && parts[1]?.length === 32 && parts[2]?.length === 32) {
        const toUuid = (hex: string) =>
          `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
        landingPageId = toUuid(parts[1]);
        userId = toUuid(parts[2]);
      }
    }

    if (!landingPageId || !userId) {
      console.error("Duitku callback: could not extract IDs", {
        merchantOrderId,
        additionalParam,
        landingPageId,
        userId,
      });
      return new NextResponse("OK", { status: 200 });
    }

    try {
      const db = createAdminClient();
      const paymentMethod = (formData.get("paymentCode") as string) ?? "duitku";

      // What was bought decides whether the money finishes the transaction. A
      // digital product is handed over by the same event that confirms payment;
      // a physical good or a service leaves the seller with work to do, and
      // that work needs a row somebody can see (20260924000000).
      const { data: product } = await db
        .from("lp_landing_pages")
        .select("product_type")
        .eq("id", landingPageId)
        .maybeSingle();
      const status = initialFulfillment(normalizeProductType(product?.product_type));

      const { error } = await db.from("lp_purchases").insert({
        user_id: userId,
        landing_page_id: landingPageId,
        amount: Number(amount) || 0,
        payment_method: paymentMethod,
        invoice_number: generateInvoiceNumber(),
        site_id: siteId,
        fulfillment_status: status,
        fulfilled_at: status === "done" ? new Date().toISOString() : null,
      });

      // Pembeli jadi orang situs tempat dia membeli (fase 5). Ditulis di sini,
      // bukan hanya saat insert berhasil: baris yang sudah ada berarti callback
      // yang dikirim ulang, dan keanggotaannya tetap harus benar. Idempoten.
      if (siteId) await ensureSiteMembership(userId, siteId);

      // Business ledger (docs/plans/multi-business-saas.md, Fase 3): record the
      // sale + commission only on a genuinely NEW purchase. Bookkeeping only, and
      // wrapped so a ledger failure can never break the payment confirmation.
      if (!error) {
        try {
          await recordSale(db, {
            landingPageId,
            siteId,
            amount: Number(amount) || 0,
            orderRef: merchantOrderId,
          });
        } catch (e) {
          console.error("ledger recordSale failed (non-fatal):", e);
        }
      }

      if (error) {
        if (error.code === "23505") {
          // A row already exists. Normally that's a retried callback and there
          // is nothing to do — but it is also what a revoked buyer hits, since
          // RLS hides the row from them and checkout therefore let them pay
          // again. Taking the money and granting nothing is not an option, so a
          // fresh payment restores access. (Free re-claims deliberately do NOT:
          // see addPurchase, where undoing a revoke would cost nothing.)
          const { data: existing } = await db
            .from("lp_purchases")
            .select("id, revoked_at")
            .eq("user_id", userId)
            .eq("landing_page_id", landingPageId)
            .maybeSingle();

          if (existing?.revoked_at) {
            await db
              .from("lp_purchases")
              .update({
                revoked_at: null,
                revoked_by: null,
                revoke_reason: null,
                amount: Number(amount) || 0,
                payment_method: paymentMethod,
                purchased_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            await grantBundleItems(userId, landingPageId);
          }
          return new NextResponse("OK", { status: 200 });
        }
        console.error("Duitku callback purchase insert error:", error);
      } else {
        // A bundle also hands over everything inside it.
        await grantBundleItems(userId, landingPageId);
        const { data: page } = await db
          .from("lp_landing_pages")
          .select("title, slug, zip_url, product_type, fulfillment_note")
          .eq("id", landingPageId)
          .single();

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        if (email) {
          // Non-digital orders have nothing to download; the link in their
          // email is where the order's status lives instead.
          let downloadUrl = deliversFile(normalizeProductType(page?.product_type))
            ? `${baseUrl}/panel`
            : `${baseUrl}/panel/purchases`;
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
            productType: normalizeProductType(page?.product_type),
            fulfillmentNote: page?.fulfillment_note ?? null,
          });
        }

        // Server-side Meta Purchase, deduped with the browser pixel via
        // merchantOrderId. No-ops unless the CAPI env vars are configured.
        await sendMetaPurchaseEvent({
          eventId: merchantOrderId,
          value: Number(amount) || 0,
          currency: "IDR",
          email,
          contentId: page?.slug ?? null,
          contentName: page?.title ?? null,
          eventSourceUrl: page?.slug ? `${baseUrl}/checkout/${page.slug}/done` : undefined,
          clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
          userAgent: req.headers.get("user-agent"),
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

/**
 * Turn a paid plan order into an actual plan.
 *
 * Idempotent by row: only an order still `pending` is settled, so Duitku's
 * retries — which it sends until it gets a 200 — cannot extend a subscription
 * twice for one payment.
 *
 * Renewing EXTENDS rather than restarts, but only when the same plan is still
 * running. Paying for another month on day twenty should give six weeks of Pro,
 * not reset to four; upgrading from Pro to Business mid-month starts Business
 * now, because the two are not the same thing and adding their time together
 * would mean paying for Business and getting Pro's leftovers.
 */
async function settlePlanOrder(merchantOrderId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("lp_plan_orders")
    .select("id, user_id, plan, months, status")
    .eq("merchant_order_id", merchantOrderId)
    .maybeSingle();

  if (!order) {
    console.error("[plans] callback untuk order yang tidak ada:", merchantOrderId);
    return;
  }
  if (order.status === "paid") return; // already settled; a retry

  const { data: profile } = await admin
    .from("lp_profiles")
    .select("plan, plan_expires_at")
    .eq("id", order.user_id)
    .maybeSingle();

  const now = new Date();
  const current = effectivePlan(profile?.plan, profile?.plan_expires_at ?? null, now.getTime());
  const runningEnd =
    current === order.plan && profile?.plan_expires_at
      ? new Date(profile.plan_expires_at)
      : null;
  const from = runningEnd && runningEnd > now ? runningEnd : now;

  const expiresAt = new Date(from);
  // setMonth handles the short months for us: 31 Jan + 1 month lands on 3 March
  // in a non-leap year, which is later than the buyer expects but never earlier —
  // the direction to be wrong in when somebody has paid.
  expiresAt.setMonth(expiresAt.getMonth() + (order.months ?? 1));

  const { error: profileError } = await admin
    .from("lp_profiles")
    .update({ plan: order.plan, plan_expires_at: expiresAt.toISOString() })
    .eq("id", order.user_id);

  if (profileError) {
    // Leave the order pending: it is money received and not yet delivered, and a
    // pending row is the only thing that will show that in the panel.
    console.error("[plans] gagal menaikkan paket:", profileError);
    return;
  }

  await admin
    .from("lp_plan_orders")
    .update({
      status: "paid",
      paid_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      invoice_number: generateInvoiceNumber(),
    })
    .eq("id", order.id)
    .eq("status", "pending");
}
