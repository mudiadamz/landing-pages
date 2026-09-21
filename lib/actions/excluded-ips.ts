"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { requireAdmin } from "@/lib/actions/profiles";

/**
 * Address-based analytics exclusion. The per-user flag only works for signed-in
 * visitors, so an owner browsing their own site logged out still lands in the
 * numbers — this covers that, plus office/staff networks.
 */

export type ExcludedIp = {
  ip: string;
  note: string | null;
  created_at: string;
  sessions: number;
};

/** The caller's public IP, as the ingestion route would see it. */
export async function getMyIp(): Promise<string | null> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  if (!first) return null;
  if (/^(127\.|10\.|192\.168\.|::1|fe80:|fc00:|fd)/i.test(first)) return null;
  return first.slice(0, 64);
}

export async function listExcludedIps(): Promise<ExcludedIp[]> {
  if (!(await requireAdmin())) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_excluded_ips")
    .select("ip, note, created_at")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Omit<ExcludedIp, "sessions">[];
  // Show whether anything still slipped through (should stay at 0 after a purge).
  return Promise.all(
    rows.map(async (r) => {
      const { count } = await admin
        .from("lp_sessions")
        .select("*", { count: "exact", head: true })
        .eq("ip", r.ip);
      return { ...r, sessions: count ?? 0 };
    }),
  );
}

/**
 * Exclude an address and delete what it already recorded — "stop counting me"
 * almost always means the past visits too.
 */
export async function addExcludedIp(
  ip: string,
  note?: string,
): Promise<{ ok: boolean; error?: string; purged?: number }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = (ip || "").trim().slice(0, 64);
  // Loose on purpose: accepts IPv4 and IPv6 without trying to fully validate.
  if (!clean || !/^[0-9a-fA-F:.]+$/.test(clean)) {
    return { ok: false, error: "Alamat IP tidak valid." };
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin
    .from("lp_excluded_ips")
    .upsert(
      { ip: clean, note: note?.trim() || null, created_by: user?.id ?? null },
      { onConflict: "ip" },
    );
  if (error) {
    console.error("addExcludedIp error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }

  const purged = await purgeIp(clean);
  revalidatePath("/panel/analytics");
  return { ok: true, purged };
}

export async function removeExcludedIp(ip: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };
  const admin = createAdminClient();
  const { error } = await admin.from("lp_excluded_ips").delete().eq("ip", ip);
  if (error) return { ok: false, error: "Gagal menghapus." };
  revalidatePath("/panel/analytics");
  return { ok: true };
}

/** Delete everything already recorded from an address. Returns sessions removed. */
async function purgeIp(ip: string): Promise<number> {
  const admin = createAdminClient();
  const { data: sess } = await admin.from("lp_sessions").select("session_id").eq("ip", ip);
  const ids = (sess ?? []).map((r) => r.session_id as string);
  if (ids.length === 0) return 0;

  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await admin.from("lp_page_events").delete().in("session_id", chunk);
    // lp_product_events has no user/ip column — session id is the only link.
    await admin.from("lp_product_events").delete().in("session_id", chunk);
  }
  await admin.from("lp_sessions").delete().eq("ip", ip);
  return ids.length;
}

/** Re-run the purge for an address already on the list. */
export async function purgeExcludedIp(ip: string): Promise<{ ok: boolean; purged: number }> {
  if (!(await requireAdmin())) return { ok: false, purged: 0 };
  const purged = await purgeIp(ip);
  revalidatePath("/panel/analytics");
  return { ok: true, purged };
}
