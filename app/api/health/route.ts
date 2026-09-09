import { NextResponse } from "next/server";

/**
 * Health check untuk Docker/orchestrator.
 *
 * Sengaja TIDAK menyentuh database. Yang ditanyakan orchestrator itu "proses ini
 * masih bisa melayani request?", bukan "seluruh sistem sehat?" — health check
 * yang ikut memeriksa Supabase akan mematikan container yang sebenarnya
 * baik-baik saja setiap kali database sedang lambat, lalu me-restart-nya, yang
 * membuat pemadaman jadi lebih lama alih-alih lebih pendek.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
