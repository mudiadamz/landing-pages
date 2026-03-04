import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

function parseFrom(from: string): { email: string; name: string | null } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || null, email: match[2].trim() };
  }
  return { email: from.trim(), name: null };
}

/** GET: cek apakah endpoint jalan dan env terisi (untuk debug). Resend hanya memanggil POST. */
export async function GET() {
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const hasSecret = !!process.env.RESEND_WEBHOOK_SECRET;
  return NextResponse.json({
    ok: true,
    message: "Webhook endpoint. Resend memanggil POST dengan event email.received.",
    configured: hasApiKey && hasSecret,
    env: { RESEND_API_KEY: hasApiKey, RESEND_WEBHOOK_SECRET: hasSecret },
  });
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!apiKey || !webhookSecret) {
      const missing = []; if (!apiKey) missing.push("RESEND_API_KEY"); if (!webhookSecret) missing.push("RESEND_WEBHOOK_SECRET");
      console.error("[resend-inbound] Missing env:", missing.join(", "));
      return NextResponse.json(
        { error: "Webhook not configured", missing: missing },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const payload = await req.text();

    const id = req.headers.get("svix-id") ?? undefined;
    const timestamp = req.headers.get("svix-timestamp") ?? undefined;
    const signature = req.headers.get("svix-signature") ?? undefined;
    if (!id || !timestamp || !signature) {
      console.error("[resend-inbound] Missing svix headers");
      return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
    }

    const result = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });

    const eventType = result.type as string;
    if (eventType !== "email.received") {
      console.info("[resend-inbound] Ignored event type:", eventType);
      return NextResponse.json({ received: false, event: eventType });
    }

    const data = result.data as { email_id?: string };
    const emailId = data?.email_id;
    if (!emailId) {
      console.error("[resend-inbound] email.received payload missing data.email_id");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { data: email, error: getError } = await resend.emails.receiving.get(emailId);
    if (getError || !email) {
      console.error("[resend-inbound] Resend receiving.get error:", getError, "emailId:", emailId);
      return NextResponse.json({ error: "Failed to fetch email content" }, { status: 502 });
    }

    const { email: fromEmail, name: fromName } = parseFrom(email.from);
    const toAddresses = Array.isArray(email.to) ? email.to : [email.to];

    const supabase = createAdminClient();
    const { error: insertError } = await supabase.from("received_emails").insert({
      resend_email_id: emailId,
      from_address: fromEmail,
      from_name: fromName ?? null,
      to_addresses: toAddresses,
      subject: email.subject ?? "",
      body_text: email.text ?? null,
      body_html: email.html ?? null,
      received_at: email.created_at ?? new Date().toISOString(),
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error("[resend-inbound] Supabase insert error:", insertError);
      return NextResponse.json({ error: "Failed to store email" }, { status: 500 });
    }

    console.info("[resend-inbound] Stored email:", emailId);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[resend-inbound] Error:", err);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
