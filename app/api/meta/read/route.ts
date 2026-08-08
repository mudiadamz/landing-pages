import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendMetaReadEvent, READ_THRESHOLD_MS } from "@/lib/meta-capi";

/**
 * Reports a genuine read (30s+ of active, visible time on a preview) to Meta,
 * so a campaign can be optimised for readers instead of link clicks.
 *
 * Server-side rather than pixel-only because the pixel is widely blocked and
 * this event is what the campaign will be *bidding on* — under-reporting it
 * would train delivery in the wrong direction. The browser fires the same
 * event id so the two dedupe.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://admuiux.com").replace(/\/$/, "");

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || null;
  if (!first) return null;
  if (/^(127\.|10\.|192\.168\.|::1|fe80:|fc00:|fd)/i.test(first)) return null;
  return first.slice(0, 64);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      slug?: string;
      eventId?: string;
      seconds?: number;
    } | null;

    const slug = body?.slug?.trim().slice(0, 200);
    const eventId = body?.eventId?.trim().slice(0, 100);
    if (!slug || !eventId) return new NextResponse(null, { status: 204 });

    const seconds = Number(body?.seconds);
    // Don't take the client's word for it — a read has to clear the threshold.
    if (!Number.isFinite(seconds) || seconds * 1000 < READ_THRESHOLD_MS) {
      return new NextResponse(null, { status: 204 });
    }

    const admin = createAdminClient();
    const ip = clientIp(req);

    // Internal traffic must never reach ad optimisation — teaching Meta to
    // find people like us is worse than reporting nothing.
    if (ip) {
      const { data: banned } = await admin
        .from("lp_excluded_ips")
        .select("ip")
        .eq("ip", ip)
        .maybeSingle();
      if (banned) return new NextResponse(null, { status: 204 });
    }
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: prof } = await admin
          .from("lp_profiles")
          .select("exclude_from_stats")
          .eq("id", data.user.id)
          .maybeSingle();
        if (prof?.exclude_from_stats) return new NextResponse(null, { status: 204 });
      }
    } catch {
      /* anonymous — nothing to exclude */
    }

    const { data: product } = await admin
      .from("lp_landing_pages")
      .select("id, title")
      .eq("slug", slug)
      .maybeSingle();
    if (!product) return new NextResponse(null, { status: 204 });

    // The pixel's own cookies are what let Meta attribute this back to the ad click.
    const jar = await cookies();
    await sendMetaReadEvent({
      eventId,
      contentId: product.id,
      contentName: product.title,
      seconds: Math.round(seconds),
      eventSourceUrl: `${SITE_URL}/preview/${slug}`,
      clientIp: ip,
      userAgent: req.headers.get("user-agent"),
      fbp: jar.get("_fbp")?.value ?? null,
      fbc: jar.get("_fbc")?.value ?? null,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
