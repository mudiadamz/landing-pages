"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/db/admin";
import { normalizeBankCode } from "@/lib/bank-codes";
import { disburse, disbursementConfig } from "@/lib/disbursement";
import { businessBalances, MIN_PAYOUT } from "@/lib/ledger";
import { managesBusiness } from "@/lib/profile-utils";
import {
  normalizeBusinessRolePermissions,
  type BusinessRolePermissions,
} from "@/lib/role-permissions";
import { editingSite } from "@/lib/site-resolve";
import { currentSiteStanding, requirePlatform } from "./profiles";

/**
 * The money side of a business — payouts, refunds, KYC (docs/plans/multi-business-saas.md,
 * Fase 3).
 *
 * Two ways money leaves, sharing one set of guards and one history:
 *
 * - `recordPayout` — bookkeeping. A human transferred at the bank; this books it
 *   so it cannot be booked twice. Always available.
 * - `sendPayout` — the Platform asks Duitku to transfer (lib/disbursement.ts).
 *   Only when credentials are configured AND the business has a bank CODE.
 *
 * Both debit the ledger BEFORE anything else happens, because the debit is what
 * stops a second request spending the same balance. `sendPayout` reverses that
 * debit with a compensating `adjustment` row only when Duitku explicitly refused;
 * an unanswered transfer stays debited and is reconciled by a human, since
 * "we don't know" must never be read as "it didn't happen".
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

export type PayoutRecord = {
  id: string;
  amount: number;
  method: string;
  status: string;
  ledger_ref: string;
  bank_code: string | null;
  bank_account: string | null;
  bank_holder: string | null;
  provider_ref: string | null;
  error: string | null;
  created_at: string;
};

export type BusinessMoneyView = {
  id: string;
  name: string;
  kyc_status: string;
  payout_bank_name: string | null;
  payout_bank_code: string | null;
  payout_bank_account: string | null;
  payout_bank_holder: string | null;
  balances: { total: number; available: number; pending: number };
  entries: LedgerEntry[];
  payouts: PayoutRecord[];
  /** Duitku disbursement credentials are configured on this deployment. */
  disbursement_enabled: boolean;
};

// Shared builder — NOT exported (a "use server" module may only export async
// functions, and this is a plain helper). Callers gate BEFORE calling it.
async function buildMoneyView(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
): Promise<BusinessMoneyView | null> {
  const { data: biz } = await admin
    .from("lp_businesses")
    .select("id, name, kyc_status, payout_bank_name, payout_bank_code, payout_bank_account, payout_bank_holder")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return null;

  const [{ data: rows }, { data: payouts }, balances] = await Promise.all([
    admin
      .from("lp_business_ledger")
      .select("id, kind, amount_cents, status, order_ref, available_at, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    admin
      .from("lp_business_payouts")
      .select("id, amount, method, status, ledger_ref, bank_code, bank_account, bank_holder, provider_ref, error, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    businessBalances(admin, businessId),
  ]);

  return {
    id: biz.id as string,
    name: biz.name as string,
    kyc_status: biz.kyc_status as string,
    payout_bank_name: (biz.payout_bank_name as string | null) ?? null,
    payout_bank_code: (biz.payout_bank_code as string | null) ?? null,
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
    payouts: (payouts ?? []).map((p) => ({
      id: p.id as string,
      amount: Number(p.amount) || 0,
      method: p.method as string,
      status: p.status as string,
      ledger_ref: p.ledger_ref as string,
      bank_code: (p.bank_code as string | null) ?? null,
      bank_account: (p.bank_account as string | null) ?? null,
      bank_holder: (p.bank_holder as string | null) ?? null,
      provider_ref: (p.provider_ref as string | null) ?? null,
      error: (p.error as string | null) ?? null,
      created_at: p.created_at as string,
    })),
    disbursement_enabled: !!disbursementConfig(),
  };
}

/**
 * What every payout has to be true of, whichever way the money moves: KYC
 * approved, a destination on file, at least MIN_PAYOUT, and within the MATURED
 * balance (the hold is the refund window — paying out of it is what makes a
 * balance go negative later).
 *
 * Returns the business row on success so the caller doesn't read it twice.
 */
type PayoutTarget = {
  kyc_status: string;
  payout_bank_name: string | null;
  payout_bank_code: string | null;
  payout_bank_account: string | null;
  payout_bank_holder: string | null;
};

async function checkPayout(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  cents: number,
): Promise<{ ok: false; error: string } | { ok: true; biz: PayoutTarget }> {
  if (!Number.isFinite(cents) || cents < MIN_PAYOUT) {
    return { ok: false, error: `Minimum payout Rp${MIN_PAYOUT.toLocaleString("id-ID")}.` };
  }
  const { data: biz } = await admin
    .from("lp_businesses")
    .select("kyc_status, payout_bank_name, payout_bank_code, payout_bank_account, payout_bank_holder")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { ok: false, error: "Business tidak ditemukan." };
  if (biz.kyc_status !== "approved") return { ok: false, error: "KYC belum disetujui." };
  if (!biz.payout_bank_account) return { ok: false, error: "Rekening payout belum diisi." };

  const balances = await businessBalances(admin, businessId);
  if (cents > balances.available) return { ok: false, error: "Melebihi saldo yang tersedia." };

  return {
    ok: true,
    biz: {
      kyc_status: biz.kyc_status as string,
      payout_bank_name: (biz.payout_bank_name as string | null) ?? null,
      payout_bank_code: (biz.payout_bank_code as string | null) ?? null,
      payout_bank_account: (biz.payout_bank_account as string | null) ?? null,
      payout_bank_holder: (biz.payout_bank_holder as string | null) ?? null,
    },
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
    .in("role", ["business", "owner", "admin"])
    .limit(1);
  const businessId = membership?.[0]?.business_id as string | undefined;
  if (!businessId) return null;
  return buildMoneyView(admin, businessId);
}

/**
 * Debit the ledger and open a payout row for it, in that order.
 *
 * The debit comes first because it is the only thing standing between two
 * concurrent requests and paying the same balance twice — `checkPayout` reads
 * the balance, and a balance read is only as good as how quickly it is spent.
 *
 * `ledger_ref` ties the two rows together and is UNIQUE on the payout table, so
 * a payout can never gain a second row for the same debit.
 */
async function openPayout(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  cents: number,
  biz: PayoutTarget,
  opts: { method: "manual" | "duitku"; status: "recorded" | "pending"; userId: string | null },
): Promise<{ ok: false; error: string } | { ok: true; id: string; ledgerRef: string }> {
  const ledgerRef = `payout-${randomUUID()}`;

  const { error: ledgerErr } = await admin.from("lp_business_ledger").insert({
    business_id: businessId,
    kind: "payout",
    amount_cents: -cents,
    status: "available",
    order_ref: ledgerRef,
  });
  if (ledgerErr) {
    console.error("openPayout ledger error:", ledgerErr);
    return { ok: false, error: "Gagal mencatat payout." };
  }

  const { data, error } = await admin
    .from("lp_business_payouts")
    .insert({
      business_id: businessId,
      amount: cents,
      method: opts.method,
      status: opts.status,
      ledger_ref: ledgerRef,
      bank_code: biz.payout_bank_code,
      bank_account: biz.payout_bank_account,
      bank_holder: biz.payout_bank_holder,
      requested_by: opts.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    // Give the money back: a debit nobody can see in the payout history is worse
    // than no debit at all.
    await admin.from("lp_business_ledger").insert({
      business_id: businessId,
      kind: "adjustment",
      amount_cents: cents,
      status: "available",
      order_ref: `${ledgerRef}-reversal`,
    });
    console.error("openPayout row error:", error);
    return { ok: false, error: "Gagal mencatat payout." };
  }
  return { ok: true, id: data.id as string, ledgerRef };
}

function refreshPayoutScreens(businessId: string): void {
  revalidatePath(`/panel/platform/${businessId}`);
  revalidatePath("/panel/platform");
  revalidatePath("/panel/business");
}

/**
 * Record a payout ("mark as paid") — a transfer a human already made at the bank.
 * Books the obligation as settled so it cannot be settled twice. Moves no money.
 */
export async function recordPayout(
  businessId: string,
  amount: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requirePlatform())) return { ok: false, error: "Akses ditolak." };
  const user = await currentUser();
  const cents = Math.round(amount);

  const admin = createAdminClient();
  const check = await checkPayout(admin, businessId, cents);
  if (!check.ok) return check;

  const opened = await openPayout(admin, businessId, cents, check.biz, {
    method: "manual",
    status: "recorded",
    userId: user?.id ?? null,
  });
  if (!opened.ok) return opened;

  refreshPayoutScreens(businessId);
  return { ok: true };
}

/**
 * Pay out through Duitku Disbursement (docs/plans/multi-business-saas.md, Fase 3).
 *
 * Same guards as the manual path, plus the two this one needs: credentials
 * configured on the deployment, and a recognised bank CODE on the business (the
 * free-text bank name cannot address a transfer).
 *
 * The three outcomes are deliberately not symmetrical:
 *   sent    → nothing more to do; the debit stands.
 *   pending → the debit stands too. Duitku has the request and may complete it;
 *             reversing here would hand the money out twice.
 *   failed  → Duitku refused before moving anything, so a compensating
 *             `adjustment` row credits the balance back.
 */
export async function sendPayout(
  businessId: string,
  amount: number,
): Promise<{ ok: boolean; error?: string; status?: string; note?: string }> {
  if (!(await requirePlatform())) return { ok: false, error: "Akses ditolak." };
  const cfg = disbursementConfig();
  if (!cfg) return { ok: false, error: "Disbursement belum dikonfigurasi (DUITKU_DISBURSE_*)." };

  const user = await currentUser();
  const cents = Math.round(amount);
  const admin = createAdminClient();

  const check = await checkPayout(admin, businessId, cents);
  if (!check.ok) return check;

  const bankCode = normalizeBankCode(check.biz.payout_bank_code);
  if (!bankCode) return { ok: false, error: "Kode bank belum diisi atau tidak dikenal." };

  const opened = await openPayout(admin, businessId, cents, check.biz, {
    method: "duitku",
    status: "pending",
    userId: user?.id ?? null,
  });
  if (!opened.ok) return opened;

  const result = await disburse(cfg, {
    amount: cents,
    bankCode,
    bankAccount: check.biz.payout_bank_account ?? "",
    purpose: `Payout ${opened.ledgerRef}`,
  });

  if (result.status === "failed") {
    await admin.from("lp_business_ledger").insert({
      business_id: businessId,
      kind: "adjustment",
      amount_cents: cents,
      status: "available",
      order_ref: `${opened.ledgerRef}-reversal`,
    });
    await admin
      .from("lp_business_payouts")
      .update({ status: "failed", error: result.message, updated_at: new Date().toISOString() })
      .eq("id", opened.id);
    refreshPayoutScreens(businessId);
    return { ok: false, error: result.message, status: "failed" };
  }

  await admin
    .from("lp_business_payouts")
    .update({
      status: result.status,
      provider_ref: result.providerRef,
      cust_ref: result.custRef,
      // The name the BANK returned, not the one we had on file — if they differ,
      // the history should say who was actually paid.
      bank_holder: result.accountName ?? check.biz.payout_bank_holder,
      error: result.status === "pending" ? result.message : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opened.id);

  refreshPayoutScreens(businessId);
  return {
    ok: true,
    status: result.status,
    note: result.status === "pending" ? result.message : undefined,
  };
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
  /** BI bank code (lib/bank-codes.ts). Optional — without it, payouts stay manual. */
  bankCode?: string | null;
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
    .in("role", ["business", "owner", "admin"])
    .limit(1);
  const businessId = membership?.[0]?.business_id as string | undefined;
  if (!businessId) return { ok: false, error: "Kamu bukan pengelola business mana pun." };

  const { error } = await admin
    .from("lp_businesses")
    .update({
      payout_bank_name: bankName,
      // Unrecognised codes are stored as null rather than as typed: a wrong code
      // is a transfer to a real stranger, and "no automatic payout" is the safe
      // failure. The manual path never reads it.
      payout_bank_code: normalizeBankCode(input.bankCode),
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

/**
 * Save the per-business feature matrix (docs/plans/multi-business-saas.md, Fase 5).
 *
 * The business is taken from the storefront the panel is editing, never from the
 * caller — the whole point of the phase is that "which business" is a property of
 * what you are looking at, not of who you are.
 *
 * Gate: Platform, or an owner/admin of THAT business. Deliberately not
 * `requireFeature` — handing out access is not itself a delegatable feature, the
 * same line /panel/roles already draws for the per-site matrix.
 */
export async function updateBusinessRolePermissions(
  perms: BusinessRolePermissions,
): Promise<{ ok: boolean; error?: string }> {
  const site = await editingSite();
  if (!site.business_id) return { ok: false, error: "Situs ini belum terhubung ke business." };

  const standing = await currentSiteStanding(site.id);
  if (!standing?.isPlatform && !managesBusiness(standing?.businessRole ?? null)) {
    return { ok: false, error: "Akses ditolak." };
  }

  const clean = normalizeBusinessRolePermissions(perms);
  const { error } = await createAdminClient()
    .from("lp_businesses")
    .update({ role_permissions: clean, updated_at: new Date().toISOString() })
    .eq("id", site.business_id);
  if (error) {
    console.error("updateBusinessRolePermissions error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  // The nav is drawn from these, so the whole panel shell has to be redrawn.
  revalidatePath("/panel", "layout");
  return { ok: true };
}
