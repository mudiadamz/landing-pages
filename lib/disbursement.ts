import crypto from "crypto";

/**
 * Sending money OUT — Duitku Disbursement (Transfer Online), the second half of
 * docs/plans/multi-business-saas.md Fase 3.
 *
 * Everything else in this codebase that talks to Duitku takes money in, where a
 * failure costs a retry. This is the other direction, where a failure can cost a
 * transfer that happened but was recorded as if it hadn't. Three rules follow
 * from that, and they are the reason this file is shaped the way it is:
 *
 * 1. **Off by default.** No credentials configured → `disbursementConfig()`
 *    returns null and the caller keeps doing what it did before (a human
 *    transfers at the bank and records it). Turning this on is an env change and
 *    a deliberate one.
 * 2. **"Don't know" is its own answer.** A timeout or an unreadable response on
 *    the TRANSFER call returns `pending`, never `failed` — the money may well be
 *    moving. Only an explicit refusal from Duitku is a failure the caller may
 *    reverse. Inquiry is different: nothing has moved yet, so its failures are
 *    plain failures.
 * 3. **Two steps, as the API requires.** Inquiry resolves the destination
 *    (accountName, custRefNumber, disburseId); transfer quotes all three back.
 *    The account name that comes back is returned to the caller so a payout row
 *    records who the bank says was paid, not who we hoped would be.
 *
 * Contract: docs.duitku.com/disbursement. Sandbox and production are different
 * HOSTS with different path suffixes, not one host with a flag.
 */

const SANDBOX_BASE = "https://sandbox.duitku.com/webapi/api/disbursement";
const PROD_BASE = "https://passport.duitku.com/webapi/api/disbursement";

/** Duitku's own timeout advice is generous; ours is what a panel click can wait for. */
const TIMEOUT_MS = 25_000;

export type DisbursementConfig = {
  /** Duitku disbursement merchant id — a different credential from the payment merchantCode. */
  userId: string;
  /** The merchant email registered with Duitku; part of every signature. */
  email: string;
  secret: string;
  sandbox: boolean;
};

/**
 * Credentials, or null when disbursement is not configured. Callers treat null as
 * "manual payouts only" — never as an error.
 */
export function disbursementConfig(): DisbursementConfig | null {
  const userId = process.env.DUITKU_DISBURSE_USER_ID?.trim();
  const email = process.env.DUITKU_DISBURSE_EMAIL?.trim();
  const secret = process.env.DUITKU_DISBURSE_SECRET?.trim();
  if (!userId || !email || !secret) return null;
  // Opt-in to production, like DUITKU_SANDBOX: the safe value is the default.
  return { userId, email, secret, sandbox: process.env.DUITKU_DISBURSE_SANDBOX !== "false" };
}

export type DisburseRequest = {
  amount: number;
  bankCode: string;
  bankAccount: string;
  /** Shown on the statement and signed into every request; Duitku requires it non-empty. */
  purpose: string;
};

export type DisburseResult =
  | { status: "sent"; providerRef: string; custRef: string | null; accountName: string | null }
  /** Handed over, outcome unknown. The ledger stays debited; a human reconciles. */
  | { status: "pending"; providerRef: string | null; custRef: string | null; accountName: string | null; message: string }
  /** Refused before any money moved. The caller may reverse its ledger debit. */
  | { status: "failed"; message: string };

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function endpoint(cfg: DisbursementConfig, op: "inquiry" | "transfer"): string {
  return cfg.sandbox ? `${SANDBOX_BASE}/${op}sandbox` : `${PROD_BASE}/${op}`;
}

type DuitkuResponse = Record<string, unknown> & {
  responseCode?: string;
  responseDesc?: string;
  accountName?: string;
  custRefNumber?: string;
  disburseId?: string;
};

async function post(url: string, body: unknown): Promise<DuitkuResponse | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // A non-JSON body (an HTML error page from a proxy, say) is unreadable, not
  // empty — returning null lets the caller decide what unreadable means for the
  // step it is on, which is the whole point of rule 2 above.
  try {
    return (await res.json()) as DuitkuResponse;
  } catch {
    return null;
  }
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Transfer `amount` to a bank account. Never throws: every outcome, including a
 * thrown fetch, comes back as one of the three statuses.
 */
export async function disburse(
  cfg: DisbursementConfig,
  req: DisburseRequest,
): Promise<DisburseResult> {
  const amount = Math.round(req.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: "failed", message: "Jumlah tidak valid." };
  }
  const purpose = req.purpose.trim() || "Payout";

  // --- 1. Inquiry. Nothing has moved yet, so any problem here is a failure. ---
  let inquiry: DuitkuResponse | null;
  try {
    const ts = Date.now();
    inquiry = await post(endpoint(cfg, "inquiry"), {
      userId: Number(cfg.userId),
      amountTransfer: amount,
      bankAccount: req.bankAccount,
      bankCode: req.bankCode,
      email: cfg.email,
      purpose,
      timestamp: ts,
      signature: sha256(
        `${cfg.email}${ts}${req.bankCode}${req.bankAccount}${amount}${purpose}${cfg.secret}`,
      ),
    });
  } catch (e) {
    return { status: "failed", message: `Inquiry gagal: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!inquiry) return { status: "failed", message: "Inquiry: jawaban Duitku tidak terbaca." };
  if (inquiry.responseCode !== "00") {
    return {
      status: "failed",
      message: `Inquiry ditolak (${inquiry.responseCode ?? "?"}): ${inquiry.responseDesc ?? "tanpa keterangan"}`,
    };
  }

  const disburseId = str(inquiry.disburseId);
  const custRef = str(inquiry.custRefNumber);
  const accountName = str(inquiry.accountName);
  if (!disburseId || !custRef || !accountName) {
    return { status: "failed", message: "Inquiry sukses tapi tidak lengkap (disburseId/custRefNumber/accountName)." };
  }

  // --- 2. Transfer. From here on, silence means "maybe", not "no". ---
  let transfer: DuitkuResponse | null;
  try {
    const ts = Date.now();
    transfer = await post(endpoint(cfg, "transfer"), {
      disburseId,
      userId: Number(cfg.userId),
      email: cfg.email,
      bankCode: req.bankCode,
      bankAccount: req.bankAccount,
      amountTransfer: amount,
      accountName,
      custRefNumber: custRef,
      purpose,
      timestamp: ts,
      signature: sha256(
        `${cfg.email}${ts}${req.bankCode}${req.bankAccount}${accountName}${custRef}${amount}${purpose}${disburseId}${cfg.secret}`,
      ),
    });
  } catch (e) {
    return {
      status: "pending",
      providerRef: disburseId,
      custRef,
      accountName,
      message: `Transfer tidak terjawab (${e instanceof Error ? e.message : String(e)}) — cek status di Duitku sebelum mengulang.`,
    };
  }
  if (!transfer) {
    return {
      status: "pending",
      providerRef: disburseId,
      custRef,
      accountName,
      message: "Transfer: jawaban Duitku tidak terbaca — cek status di Duitku sebelum mengulang.",
    };
  }

  const code = transfer.responseCode ?? "";
  if (code === "00") return { status: "sent", providerRef: disburseId, custRef, accountName };

  // Duitku's own "don't retry / wait" codes: 68 pending (confirmed T+1), 80
  // waiting for callback, TO timed out. Treating any of these as failure would
  // credit the balance back for money that is on its way.
  if (code === "68" || code === "80" || code === "TO") {
    return {
      status: "pending",
      providerRef: disburseId,
      custRef,
      accountName,
      message: `Duitku ${code}: ${transfer.responseDesc ?? "menunggu konfirmasi"}`,
    };
  }

  return {
    status: "failed",
    message: `Transfer ditolak (${code || "?"}): ${transfer.responseDesc ?? "tanpa keterangan"}`,
  };
}
