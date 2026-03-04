import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

function parseFrom(from: string): { email: string; name: string | null } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || null, email: match[2].trim() };
  }
  return { email: from.trim(), name: null };
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not set");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const id = req.headers.get("svix-id") ?? undefined;
    const timestamp = req.headers.get("svix-timestamp") ?? undefined;
    const signature = req.headers.get("svix-signature") ?? undefined;
    if (!id || !timestamp || !signature) {
      return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
    }

    const result = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });

    if (result.type !== "email.received") {
      return NextResponse.json({ received: false });
    }

    const emailId = result.data.email_id;
    const { data: email, error: getError } = await resend.emails.receiving.get(emailId);
    if (getError || !email) {
      console.error("Resend get receiving email error:", getError);
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
      console.error("Insert received_emails error:", insertError);
      return NextResponse.json({ error: "Failed to store email" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Resend inbound webhook error:", err);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
