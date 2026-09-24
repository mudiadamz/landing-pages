"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/db/admin";
import { sendBusinessDecisionEmail } from "@/lib/email";
import { canonicalOrigin } from "@/lib/site-resolve";
import { slugFromTitle } from "@/lib/slug";
import { requirePlatform } from "./profiles";

/**
 * Business signup + Platform approval (docs/plans/multi-business-saas.md, Fase 4).
 *
 * Every write here uses the service-role client because lp_businesses /
 * lp_business_members are service-role-only (Fase 0). That is safe only because
 * each function carries its own authorisation gate — a logged-in applicant who is
 * not yet tied to any business, or requirePlatform() for the approve/reject side.
 * Nothing here moves money or provisions payouts; that is Fase 3, held for review.
 */

export type BusinessApplyInput = {
  name: string;
  businessType: "individual" | "company";
  contactEmail?: string;
  desiredHost?: string;
  note?: string;
};

// A host, not a URL: no scheme, no path, no trailing dot. Mirrors the storefront
// rules in lib/actions/sites.ts so an approved application can become a site later.
function cleanHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function hostError(host: string): string | null {
  if (!host) return null; // optional
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return "Domain tidak valid.";
  return null;
}

async function uniqueSlug(admin: ReturnType<typeof createAdminClient>, name: string): Promise<string> {
  const base = slugFromTitle(name) || "business";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await admin.from("lp_businesses").select("id").eq("slug", slug).limit(1);
    if (!data || data.length === 0) return slug;
  }
  // Vanishingly unlikely; a timestamp suffix always resolves it.
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * A logged-in user asks to run a Business. Lands `pending`; the applicant becomes
 * its `owner` so the row is never orphaned. One business per person for now: the
 * membership table is the eligibility check (a user already tied to any business
 * cannot open a second through this form).
 */
export async function applyForBusiness(
  input: BusinessApplyInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Harus login dulu." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nama business wajib diisi." };

  const host = cleanHost(input.desiredHost ?? "");
  const hErr = hostError(host);
  if (hErr) return { ok: false, error: hErr };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("lp_business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: false, error: "Kamu sudah terhubung ke sebuah business." };
  }

  const slug = await uniqueSlug(admin, name);
  const { data: biz, error } = await admin
    .from("lp_businesses")
    .insert({
      name,
      slug,
      business_type: input.businessType === "company" ? "company" : "individual",
      status: "pending",
      contact_email: input.contactEmail?.trim() || user.email || null,
      desired_host: host || null,
      note: input.note?.trim() || null,
      applied_by: user.id,
    })
    .select("id")
    .single();

  if (error || !biz) {
    console.error("applyForBusiness error:", error);
    return { ok: false, error: "Gagal mengirim pengajuan." };
  }

  const { error: memberErr } = await admin
    .from("lp_business_members")
    .insert({ business_id: biz.id, user_id: user.id, role: "business" });
  if (memberErr) {
    // Roll back the orphan: a business with no owner is unreachable and would
    // just clog the Platform queue.
    await admin.from("lp_businesses").delete().eq("id", biz.id);
    console.error("applyForBusiness member error:", memberErr);
    return { ok: false, error: "Gagal mengirim pengajuan." };
  }

  revalidatePath("/panel/platform");
  revalidatePath("/panel/apply-business");
  return { ok: true };
}

/**
 * Platform approves a pending business. If it asked for a storefront and the host
 * is free, provision the lp_sites row now (business_id set) so the domain is live
 * the moment DNS points at us — the Caddy on-demand TLS path only needs the row.
 * A taken/invalid host is not fatal: the business still activates, and the domain
 * can be added from /panel/sites afterwards.
 */
export async function approveBusiness(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requirePlatform())) return { ok: false, error: "Akses ditolak." };
  const admin = createAdminClient();

  const { data: biz } = await admin
    .from("lp_businesses")
    .select("id, name, status, desired_host, contact_email, applied_by")
    .eq("id", id)
    .single();
  if (!biz) return { ok: false, error: "Business tidak ditemukan." };

  const { error } = await admin
    .from("lp_businesses")
    .update({ status: "active", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("approveBusiness error:", error);
    return { ok: false, error: "Gagal menyetujui." };
  }

  let provisioned: string | null = null;
  const host = cleanHost((biz.desired_host as string) || "");
  if (host && !hostError(host)) {
    const { data: taken } = await admin.from("lp_sites").select("id").eq("host", host).limit(1);
    if (!taken || taken.length === 0) {
      const { error: siteErr } = await admin.from("lp_sites").insert({
        host,
        name: biz.name as string,
        is_canonical: false,
        business_id: id,
      });
      if (siteErr) console.error("approveBusiness site provisioning error:", siteErr);
      // Only announce a domain that actually exists now: a taken host means the
      // business still has to add one from /panel/sites.
      else provisioned = host;
    }
  }

  await notifyDecision(admin, biz, true, provisioned);
  revalidatePath("/panel/platform");
  return { ok: true };
}

/** Platform rejects a pending business → suspended (kept for the audit trail). */
export async function rejectBusiness(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requirePlatform())) return { ok: false, error: "Akses ditolak." };
  const admin = createAdminClient();

  const { data: biz } = await admin
    .from("lp_businesses")
    .select("id, name, contact_email, applied_by")
    .eq("id", id)
    .single();
  if (!biz) return { ok: false, error: "Business tidak ditemukan." };

  const { error } = await admin
    .from("lp_businesses")
    .update({ status: "suspended", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("rejectBusiness error:", error);
    return { ok: false, error: "Gagal menolak." };
  }

  await notifyDecision(admin, biz, false, null);
  revalidatePath("/panel/platform");
  return { ok: true };
}

/**
 * Email the applicant the decision (Fase 4). Not exported — a `"use server"`
 * module may only export async functions that are safe to call from a browser,
 * and this one takes a service-role client.
 *
 * Called AFTER the status is written, and never awaited for its success: the
 * decision is the product, the email is the courtesy. `contact_email` is what the
 * applicant typed; the profile address is the fallback for an application that
 * left it blank.
 */
async function notifyDecision(
  admin: ReturnType<typeof createAdminClient>,
  biz: { name?: unknown; contact_email?: unknown; applied_by?: unknown },
  approved: boolean,
  host: string | null,
): Promise<void> {
  try {
    let to = typeof biz.contact_email === "string" ? biz.contact_email.trim() : "";
    if (!to && typeof biz.applied_by === "string") {
      const { data: profile } = await admin
        .from("lp_profiles")
        .select("email")
        .eq("id", biz.applied_by)
        .maybeSingle();
      to = ((profile?.email as string | null) ?? "").trim();
    }
    if (!to) return;

    await sendBusinessDecisionEmail({
      to,
      businessName: String(biz.name ?? "Business"),
      approved,
      host,
      origin: canonicalOrigin(),
    });
  } catch (e) {
    console.error("notifyDecision error:", e);
  }
}
