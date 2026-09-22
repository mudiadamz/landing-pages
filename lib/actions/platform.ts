import { requirePlatform } from "@/lib/actions/profiles";
import { createAdminClient } from "@/lib/db/admin";

export type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  business_type: "individual" | "company";
  status: string;
  plan: string;
  commission_pct: number;
  kyc_status: string;
  created_at: string;
  contact_email: string | null;
  desired_host: string | null;
  note: string | null;
  members: number;
  balance: number;
  pending: number;
};

/**
 * Platform-wide business overview (docs/plans/multi-business-saas.md, Fase 4).
 * Read-only, Platform-only. Balances come from the ledger (SUM), never a stored
 * column. Uses the service-role client because it is a cross-business view.
 */
export async function listBusinessesForPlatform(): Promise<BusinessRow[]> {
  if (!(await requirePlatform())) return [];
  const admin = createAdminClient();

  const [{ data: businesses }, { data: ledger }, { data: members }] = await Promise.all([
    admin
      .from("lp_businesses")
      .select("id, name, slug, business_type, status, plan, commission_pct, kyc_status, created_at, contact_email, desired_host, note")
      .order("created_at", { ascending: true }),
    admin.from("lp_business_ledger").select("business_id, amount_cents, status"),
    admin.from("lp_business_members").select("business_id"),
  ]);

  const balance = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const l of ledger ?? []) {
    const id = l.business_id as string;
    const amt = Number(l.amount_cents) || 0;
    balance.set(id, (balance.get(id) ?? 0) + amt);
    if (l.status === "pending") pending.set(id, (pending.get(id) ?? 0) + amt);
  }
  const memberCount = new Map<string, number>();
  for (const m of members ?? []) {
    const id = m.business_id as string;
    memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
  }

  return (businesses ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    slug: b.slug as string,
    business_type: (b.business_type as "individual" | "company") ?? "individual",
    status: b.status as string,
    plan: b.plan as string,
    commission_pct: Number(b.commission_pct) || 0,
    kyc_status: b.kyc_status as string,
    created_at: b.created_at as string,
    contact_email: (b.contact_email as string | null) ?? null,
    desired_host: (b.desired_host as string | null) ?? null,
    note: (b.note as string | null) ?? null,
    members: memberCount.get(b.id as string) ?? 0,
    balance: balance.get(b.id as string) ?? 0,
    pending: pending.get(b.id as string) ?? 0,
  }));
}
