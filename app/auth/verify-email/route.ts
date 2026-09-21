import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { readVerifyToken } from "@/lib/email-verify";

/**
 * Landing point for the link in our verification email.
 *
 * Deliberately a GET that anyone can follow without being signed in: the link is
 * opened from a mail client, often on a different device from the one that
 * signed up, and demanding a login first would put the thing being verified
 * behind the thing it unlocks. The signed token is the proof — holding it means
 * having received mail at that address, which is the entire question.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const result = readVerifyToken(token);
  const to = (status: string) => new URL(`/panel?verify=${status}`, req.url);

  if (!result.ok) {
    return NextResponse.redirect(to(result.reason));
  }

  // Service role: the visitor may have no session here at all.
  const admin = createAdminClient();
  const { error } = await admin
    .from("lp_profiles")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", result.userId)
    // Idempotent, and keeps the original moment if they click twice.
    .is("email_verified_at", null);

  if (error) {
    console.error("verify-email update error:", error);
    return NextResponse.redirect(to("error"));
  }

  return NextResponse.redirect(to("ok"));
}
