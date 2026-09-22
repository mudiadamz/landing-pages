"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/db/admin";
import { businessBalances, MIN_PAYOUT } from "@/lib/ledger";
import { requirePlatform } from "./profiles";

/**
 * The money side of a business — payouts, refunds, KYC (docs/plans/multi-business-saas.md,
 * Fase 3, second half). RECORDING & WORKFLOW ONLY: every function here writes a
 * ledger row or a status, and NOTHING calls a disbursement API. A payout row means
 * "the Platform has paid this out" (the actual bank transfer is done by a human,
 * outside this system); recording it debits the ledger so the money can't be paid
 * twice. This keeps the dangerous half — wiring a real disbursement gateway —
 * explicitly out of scope until reviewed.
 */

export type LedgerEntry = {
  id: string;
  kind: string;
  amount_cents: number;
  status: string;
  order_ref: string | null;
  available_at: string | null;
  created_at: string;
};

export type BusinessMoneyView = {
  id: string;
  name: string;
  kyc_status: string;
  payout_bank_name: string | null;
  payout_bank_account: string | null;
  payout_bank_holder: string | null;
  balances: { total: number; available: number; pending: number };
  entries: LedgerEntry[];
};

// Shared builder — NOT exported (a "use server" module may only export async
// functions, and this is a plain helper). Callers gate BEFORE calling it.
async function buildMoneyView(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
): Promise<BusinessMoneyView | null> {
  const { data: biz } = await admin
    .from("lp_businesses")
    .select("id, name, kyc_status, payout_bank_name, payout_bank_account, payout_bank_holder")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return null;

  const [{ data: rows }, balances] = await Promise.all([
    admin
      .from("lp_business_ledger")
      .select("id, kind, amount_cents, status, order_ref, available_at, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    businessBalances(admin, businessId),
  ]);

  return {
    id: biz.id as string,
    name: biz.name as string,
    kyc_status: biz.kyc_status as string,
    payout_bank_name: (biz.payout_bank_name as string | null) ?? null,
    payout_bank_account: (biz.payout_bank_account as string | null) ?? null,
    payout_bank_holder: (biz.payout_bank_holder as string | null) ?? null,
    balances,
    entries: (rows ?? []).map((r) => ({
      id: r.id as string,
      kind: r.kind as string,
      amount_cents: Number(r.amount_cents) || 0,
      status: r.status as string,
      order_ref: (r.order_ref as string | null) ?? null,
      available_at: (r.available_at as string | null) ?? null,
      created_at: r.created_at as string,
    })),
  };
}

/** Full money view of one business — Platform-only (cross-business). */
export async function getBusinessMoney(businessId: string): Promise<BusinessMoneyView | null> {
  if (!(await requirePlatform())) return null;
  return buildMoneyView(createAdminClient(), businessId);
}

/**
 * The caller's OWN business money view (owner/admin). Membership is the gate — no
 * requirePlatform. Returns null if the user manages no business.
 */
export async function getMyBusinessMoney(): Promise<BusinessMoneyView | null> {
  const user = await currentUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("lp_business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1);
  const businessId = membership?.[0]?.business_id as string | undefined;
  if (!businessId) return null;
  return buildMoneyView(admin, businessId);
}

/**
 * Record a payout ("mark as paid"). Debits the ledger by `amount`. Guards: KYC
 * approved, bank details on file, amount within the AVAILABLE (matured) balance,
 * and at least MIN_PAYOUT. No money leaves anything — this books the obligation
 * as settled so it cannot be paid twice.
 */
export async function recordPayout(
  businessId: string,
  amount: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requirePlatform())) return { ok: false, error: "Akses ditolak." };
  const cents = Math.round(amount);
  if (!Number.isFinite(cents) || cents < MIN_PAYOUT) {
    return { ok: false, error: `Minimum payout Rp${MIN_PAYOUT.toLocaleString("id-ID")}.` };
  }

  const admin = createAdminClient();
  const { data: biz } = await admin
    .from("lp_businesses")
    .select("kyc_status, payout_bank_account")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { ok: false, error: "Business tidak ditemukan." };
  if (biz.kyc_status !== "approved") return { ok: false, error: "KYC belum disetujui." };
  if (!biz.payout_bank_account) return { ok: false, error: "Rekening payout belum diisi." };

  const balances = await businessBalances(admin, businessId);
  if (cents > balances.available) {
    return { ok: false, error: "Melebihi saldo yang tersedia." };
  }

  const { error } = await admin.from("lp_business_ledger").insert({
    business_id: businessId,
    kind: "payout",
    amount_cents: -cents,
    status: "available",
    order_ref: `payout-${Date.now()}`,
  });
  if (error) {
    console.error("recordPayout error:", error);
    return { ok: false, error: "Gagal mencatat payout." };
  }
  revalidatePath(`/panel/platform/${businessId}`);
  revalidatePath("/panel/platform");
  return { ok: true };
}

/**
 * Record a refund against a business (negative ledger row). Bites the balance
 * immediately (no hold). Idempotent per order_ref so a retried refund is booked
 * once.
 */
export async function recordRefund(
  businessId: string,
  amount: number,
  orderRef: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requirePlatform())) return { ok: false, error: "Akses ditolak." };
  const cents = Math.round(amount);
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false, error: "Jumlah tidak valid." };
  const ref = orderRef.trim();
  if (!ref) return { ok: false, error: "Nomor order wajib diisi." };

  const admin = createAdminClient();
  const { data: seen } = await admin
    .from("lp_business_ledger")
    .select("id")
    .eq("business_id", businessId)
    .eq("order_ref", ref)
    .eq("kind", "refund")
    .maybeSingle();
  if (seen) return { ok: false, error: "Refund untuk order ini sudah dicatat." };

  const { error } = await admin.from("lp_business_ledger").insert({
    business_id: businessId,
    kind: "refund",
    amount_cents: -cents,
    status: "available",
    order_ref: ref,
  });
  if (error) {
    console.error("recordRefund error:", error);
    return { ok: false, error: "Gagal mencatat refund." };
  }
  revalidatePath(`/panel/platform/${businessId}`);
  revalidatePath("/panel/platform");
  return { ok: true };
}

/** Platform approves/rejects a business's KYC. */
export async function reviewBusinessKyc(
  businessId: string,
  approve: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requirePlatform())) return { ok: false, error: "Akses ditolak." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("lp_businesses")
    .update({ kyc_status: approve ? "approved" : "rejected" })
    .eq("id", businessId);
  if (error) {
    console.error("reviewBusinessKyc error:", error);
    return { ok: false, error: "Gagal memperbarui KYC." };
  }
  revalidatePath(`/panel/platform/${businessId}`);
  return { ok: true };
}

export type KycInput = {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
};

/**
 * A business owner/admin submits payout bank details and requests KYC review.
 * Resolves the caller's business from membership (owner or admin only). Writes
 * with the service role because lp_businesses is service-role-only; the gate is
 * the membership check.
 */
export async function submitBusinessKyc(input: KycInput): Promise<{ ok: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Harus login." };

  const bankName = input.bankName.trim();
  const bankAccount = input.bankAccount.trim();
  const bankHolder = input.bankHolder.trim();
  if (!bankName || !bankAccount || !bankHolder) {
    return { ok: false, error: "Semua data rekening wajib diisi." };
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("lp_business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1);
  const businessId = membership?.[0]?.business_id as string | undefined;
  if (!businessId) return { ok: false, error: "Kamu bukan pengelola business mana pun." };

  const { error } = await admin
    .from("lp_businesses")
    .update({
      payout_bank_name: bankName,
      payout_bank_account: bankAccount,
      payout_bank_holder: bankHolder,
      kyc_status: "pending",
    })
    .eq("id", businessId);
  if (error) {
    console.error("submitBusinessKyc error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  revalidatePath("/panel/business");
  revalidatePath(`/panel/platform/${businessId}`);
  return { ok: true };
}
