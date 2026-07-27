import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Visitor analytics ingestion. Accepts a small JSON event from the preview /
 * checkout pages (via fetch or sendBeacon), resolves the slug to a product, and
 * stores it in lp_product_events using the service role. Public + best-effort:
 * always answers 200 so a beacon never surfaces an error, and every field is
 * validated/clamped before insert.
 */

const KINDS = new Set(["view", "session", "cta", "scroll"]);
const PAGES = new Set(["preview", "checkout"]);
const DEVICES = new Set(["mobile", "tablet", "desktop"]);

function clamp(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const slug = clamp(body.slug, 200);
    const kind = clamp(body.kind, 20);
    if (!slug || !kind || !KINDS.has(kind)) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const supabase = createAdminClient();

    // Skip internal traffic (team accounts flagged exclude_from_stats).
    try {
      const authed = await createServerClient();
      const { data: auth } = await authed.auth.getUser();
      if (auth.user) {
        const { data: prof } = await supabase
          .from("lp_profiles")
          .select("exclude_from_stats")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (prof?.exclude_from_stats) return NextResponse.json({ ok: true }, { status: 200 });
      }
    } catch {
      /* anonymous — nothing to exclude */
    }

    const { data: page } = await supabase
      .from("lp_landing_pages")
      .select("id")
      .eq("slug", slug)
      .single();
    if (!page) return NextResponse.json({ ok: false }, { status: 200 });

    const pageKind = clamp(body.page, 20);
    const device = clamp(body.device, 20);
    const durationRaw = Number(body.durationMs);
    const duration =
      Number.isFinite(durationRaw) && durationRaw > 0
        ? Math.min(Math.round(durationRaw), 6 * 60 * 60 * 1000) // cap 6h
        : null;

    await supabase.from("lp_product_events").insert({
      landing_page_id: page.id,
      session_id: clamp(body.sessionId, 80),
      kind,
      page: pageKind && PAGES.has(pageKind) ? pageKind : null,
      referrer_host: clamp(body.referrerHost, 255),
      device: device && DEVICES.has(device) ? device : null,
      browser: clamp(body.browser, 40),
      os: clamp(body.os, 40),
      // 'session' stores active time; 'scroll' stores time-to-first-scroll.
      duration_ms: kind === "session" || kind === "scroll" ? duration : null,
      cta_action: kind === "cta" ? clamp(body.ctaAction, 40) : null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
