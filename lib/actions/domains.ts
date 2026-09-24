"use server";

import { randomBytes } from "node:crypto";
import { resolveCname, resolveTxt } from "node:dns/promises";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getProfile } from "./profiles";
import {
  cnameMatches,
  customHostProblem,
  domainState,
  normalizeCustomHost,
  txtMatches,
  verificationHost,
  verificationValue,
  type DomainState,
} from "@/lib/custom-domain";
import {
  isIssuingError,
  mayRetry,
  retryAfterSeconds,
  verdictFromResponse,
  type DomainVerdict,
} from "@/lib/cert-check";

/**
 * A business bringing its own domain, without anyone editing a config file.
 *
 * Three facts have to line up before `shop.mereksendiri.com` serves anything:
 *
 *   1. a row in `lp_sites` owned by that business    ← requestCustomDomain()
 *   2. a TXT record proving they own the domain      ← verifyCustomDomain()
 *   3. a CNAME sending traffic to the edge           ← their registrar
 *
 * Only (2) authorises. The CNAME is checked so the panel can tell someone where
 * they have got to, but a domain is never served on the strength of its DNS
 * pointing at us — that is the one thing an attacker can also do.
 *
 * Reads and writes with the service role and an explicit ownership gate: RLS on
 * `lp_sites` is written for readers, and a business owner is not an admin.
 */

/** Where customers are told to point their CNAME. One value, one place. */
export async function edgeTarget(): Promise<string> {
  return process.env.CUSTOM_DOMAIN_TARGET || "edge.mbahgpt.com";
}

/**
 * Same invalidation the site screens use (lib/actions/sites.ts): a domain row
 * IS the thing `site-by-host` caches, so a stale entry means the new domain
 * keeps 404ing for up to a minute after it verifies. "max" is
 * stale-while-revalidate; `updateTag` gives this action's own response
 * read-your-own-writes.
 */
function bustSiteCaches() {
  for (const tag of ["sites", "homepage-pages"]) {
    revalidateTag(tag, "max");
    updateTag(tag);
  }
  revalidatePath("/", "layout");
  revalidatePath("/panel/domains");
}

export type DomainRow = {
  id: string;
  host: string;
  name: string;
  active: boolean;
  verifiedAt: string | null;
  verificationHost: string;
  verificationValue: string;
  dnsTarget: string;
  lastCheckAt: string | null;
  lastCheckError: string | null;
  certReadyAt: string | null;
  certCheckedAt: string | null;
  certError: string | null;
};

export type DomainCheck = {
  ok: boolean;
  state: DomainState;
  txtFound: boolean;
  cnameOk: boolean;
  error?: string;
};

/**
 * Which business this person may register a domain for.
 *
 * Owners only. A staff member sells inside someone else's business; pointing a
 * domain at it is a decision about the business itself, and `lp_sites.host` is
 * globally unique, so a mistake here is not reversible by the person who made it.
 */
async function ownedBusinessId(): Promise<string | null> {
  const profile = await getProfile();
  if (!profile) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_business_members")
    .select("business_id, role")
    .eq("user_id", profile.id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  return (data as { business_id: string } | null)?.business_id ?? null;
}

/** The caller may touch this site: Platform, or an owner of the business behind it. */
async function mayManage(siteId: string): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;
  if (profile.is_platform) return true;
  const businessId = await ownedBusinessId();
  if (!businessId) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_sites")
    .select("business_id")
    .eq("id", siteId)
    .maybeSingle();
  return (data as { business_id: string | null } | null)?.business_id === businessId;
}

const PROBLEM_MESSAGE: Record<string, string> = {
  empty: "Domain belum diisi.",
  invalid: "Format domain tidak valid. Contoh: shop.mereksendiri.com",
  apex:
    "Pakai subdomain, bukan domain utama. CNAME tidak boleh dipasang di domain utama — contoh yang benar: shop.mereksendiri.com",
  reserved: "Domain itu tidak bisa dipakai.",
  "too-long": "Domain terlalu panjang.",
};

/** Domains this business has registered, with the records they still need. */
export async function listMyDomains(): Promise<DomainRow[]> {
  const profile = await getProfile();
  if (!profile) return [];
  const businessId = await ownedBusinessId();
  if (!businessId && !profile.is_platform) return [];

  const admin = createAdminClient();
  let q = admin
    .from("lp_sites")
    .select(
      "id, host, name, active, verified_at, verification_token, dns_target, last_check_at, last_check_error, cert_ready_at, cert_checked_at, cert_error",
    )
    .order("created_at", { ascending: true });
  if (!profile.is_platform) q = q.eq("business_id", businessId);
  const { data } = await q;

  const target = await edgeTarget();
  type Row = {
    id: string;
    host: string;
    name: string;
    active: boolean;
    verified_at: string | null;
    verification_token: string | null;
    dns_target: string | null;
    last_check_at: string | null;
    last_check_error: string | null;
    cert_ready_at: string | null;
    cert_checked_at: string | null;
    cert_error: string | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    host: r.host,
    name: r.name,
    active: r.active,
    verifiedAt: r.verified_at,
    verificationHost: verificationHost(r.host),
    verificationValue: verificationValue(r.verification_token ?? ""),
    dnsTarget: r.dns_target ?? target,
    lastCheckAt: r.last_check_at,
    lastCheckError: r.last_check_error,
    certReadyAt: r.cert_ready_at,
    certCheckedAt: r.cert_checked_at,
    certError: r.cert_error,
  }));
}

/**
 * Register a domain, inactive and unverified.
 *
 * The row exists immediately so the panel has something to show the records
 * against — but `active` stays false and `verified_at` stays null, which is
 * what keeps /api/tls-check saying no. A registered-but-unproven domain is
 * inert: it reserves the name for this business and does nothing else.
 */
export async function requestCustomDomain(
  rawHost: string,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Tidak diizinkan." };
  const businessId = profile.is_platform ? null : await ownedBusinessId();
  if (!profile.is_platform && !businessId) {
    return { ok: false, error: "Hanya pemilik business yang bisa menambah domain." };
  }

  const host = normalizeCustomHost(rawHost);
  const problem = customHostProblem(host);
  if (problem) return { ok: false, error: PROBLEM_MESSAGE[problem] };

  const admin = createAdminClient();
  // `lp_sites.host` is UNIQUE, so this is a race the database would win anyway —
  // asked first only to answer with a sentence instead of a 23505.
  const { data: taken } = await admin.from("lp_sites").select("id").eq("host", host).maybeSingle();
  if (taken) return { ok: false, error: "Domain itu sudah terdaftar." };

  const { data, error } = await admin
    .from("lp_sites")
    .insert({
      host,
      name: host,
      business_id: businessId,
      template: "default",
      active: false,
      is_canonical: false,
      verification_token: randomBytes(16).toString("hex"),
      dns_target: await edgeTarget(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("requestCustomDomain:", error);
    return { ok: false, error: "Gagal menyimpan domain." };
  }
  bustSiteCaches();
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Ask DNS whether the two records are there yet.
 *
 * Both lookups are attempted even when the first fails, because the owner needs
 * to know about both records in one visit — reporting the TXT and stopping
 * would send them back for a second round trip to learn about the CNAME.
 *
 * A resolver error is NOT a failure of the domain. NXDOMAIN on the verification
 * label simply means the record is not there yet, which is the ordinary state
 * five minutes after someone adds it.
 */
export async function checkCustomDomain(siteId: string): Promise<DomainCheck> {
  if (!(await mayManage(siteId))) {
    return { ok: false, state: "unverified", txtFound: false, cnameOk: false, error: "Tidak diizinkan." };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_sites")
    .select("host, verification_token, verified_at, dns_target")
    .eq("id", siteId)
    .maybeSingle();
  const row = data as
    | { host: string; verification_token: string | null; verified_at: string | null; dns_target: string | null }
    | null;
  if (!row) return { ok: false, state: "unverified", txtFound: false, cnameOk: false, error: "Domain tidak ditemukan." };

  const token = row.verification_token ?? "";
  const target = row.dns_target ?? (await edgeTarget());

  let txtFound = false;
  let txtError: string | null = null;
  try {
    txtFound = txtMatches(await resolveTxt(verificationHost(row.host)), token);
  } catch (e) {
    // ENOTFOUND/ENODATA is "no record yet", not a problem to report as an error.
    const code = (e as { code?: string }).code ?? "";
    txtError = code === "ENOTFOUND" || code === "ENODATA" ? null : code || String(e);
  }

  let cnameOk = false;
  try {
    cnameOk = cnameMatches(await resolveCname(row.host), target);
  } catch {
    cnameOk = false;
  }

  /**
   * Verification is a LATCH, not a live reading.
   *
   * Once proven it stays proven: a later lookup that fails — their DNS provider
   * having a bad minute, a resolver timeout — must not un-verify a working
   * domain and take its certificate renewal down with it. Removing a domain is
   * a deliberate act, not something a transient NXDOMAIN does on our behalf.
   */
  const justVerified = !row.verified_at && txtFound;
  const verifiedAt = row.verified_at ?? (txtFound ? new Date().toISOString() : null);

  const update: Record<string, unknown> = {
    verified_at: verifiedAt,
    last_check_at: new Date().toISOString(),
    last_check_error: txtError,
  };
  /**
   * `active` is flipped exactly once, by the check that first proves ownership.
   *
   * Setting it on every successful check would quietly re-enable a storefront
   * an admin had deliberately switched off — the check runs from a button the
   * owner presses, and it must not be able to undo a decision that was not his.
   */
  if (justVerified) update.active = true;

  await admin.from("lp_sites").update(update).eq("id", siteId);

  bustSiteCaches();

  /**
   * Both records in place is exactly the moment a certificate can be had, so
   * take it — the owner is standing right here, and the alternative is that the
   * first person to visit the shop waits for Let's Encrypt instead.
   *
   * Failures here are deliberately not surfaced: this is opportunistic, the
   * backoff inside warmCustomDomain still applies, and the panel has its own
   * button that reports properly.
   */
  if (verifiedAt && cnameOk) {
    await warmCustomDomain(siteId).catch(() => undefined);
  }

  return {
    ok: true,
    state: domainState({ verifiedAt, cnameOk }),
    txtFound: txtFound || !!row.verified_at,
    cnameOk,
    error: txtError ?? undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*  Certificate readiness                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Make one HTTPS request to the domain and see who answers.
 *
 * This IS the issuance trigger. On-demand TLS mints a certificate on the first
 * handshake for a host, and nothing requires that handshake to come from a
 * customer — so we make it, from a button or from cron, and the first real
 * visitor arrives to a certificate that already exists.
 *
 * Certificate validation stays ON (fetch's default). A handshake that only
 * succeeds because we stopped checking is not evidence of anything; the whole
 * question is whether a *browser* would accept this.
 *
 * HEAD, not GET: the storefront's HTML is irrelevant here, and a blog homepage
 * is not a cheap thing to fetch every fifteen minutes for every domain.
 */
async function probeDomain(host: string, timeoutMs = 30_000): Promise<DomainVerdict> {
  try {
    const res = await fetch(`https://${host}/`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "adm-domain-check/1" },
    });
    return verdictFromResponse(res.headers);
  } catch (e) {
    const err = e as { name?: string; cause?: { code?: string }; message?: string };
    if (err.name === "TimeoutError" || err.name === "AbortError") return { state: "issuing" };
    const code = err.cause?.code;
    if (isIssuingError(code)) return { state: "issuing" };
    return { state: "failed", reason: code || err.message || "gagal terhubung" };
  }
}

export type WarmResult = {
  ok: boolean;
  state: DomainVerdict["state"] | "blocked";
  message?: string;
  retryAfter?: number;
};

/**
 * Get a certificate for this domain now, rather than when someone visits.
 *
 * Refuses unless ownership is proven: the edge would refuse too (/api/tls-check
 * reads the same column), and burning a Let's Encrypt attempt to be told that
 * by a third party is worse than being told here.
 */
export async function warmCustomDomain(siteId: string): Promise<WarmResult> {
  if (!(await mayManage(siteId))) return { ok: false, state: "blocked", message: "Tidak diizinkan." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_sites")
    .select("host, verified_at, cert_checked_at")
    .eq("id", siteId)
    .maybeSingle();
  const row = data as { host: string; verified_at: string | null; cert_checked_at: string | null } | null;
  if (!row) return { ok: false, state: "blocked", message: "Domain tidak ditemukan." };
  if (!row.verified_at) {
    return { ok: false, state: "blocked", message: "Verifikasi kepemilikan domain dulu." };
  }

  if (!mayRetry(row.cert_checked_at)) {
    const retryAfter = retryAfterSeconds(row.cert_checked_at);
    return {
      ok: false,
      state: "blocked",
      retryAfter,
      message: `Tunggu ${retryAfter} detik sebelum mencoba lagi.`,
    };
  }

  const verdict = await probeDomain(row.host);
  const now = new Date().toISOString();

  await admin
    .from("lp_sites")
    .update({
      cert_checked_at: now,
      // Only OUR edge answering writes readiness. "issuing" leaves the previous
      // value alone: a domain that was ready yesterday and is slow today has
      // not stopped being ready.
      ...(verdict.state === "ready" ? { cert_ready_at: now, cert_error: null } : {}),
      ...(verdict.state === "failed" ? { cert_error: verdict.reason } : {}),
      ...(verdict.state === "elsewhere" ? { cert_error: null } : {}),
      ...(verdict.state === "issuing" ? { cert_error: null } : {}),
    })
    .eq("id", siteId);

  bustSiteCaches();

  if (verdict.state === "ready") return { ok: true, state: "ready" };
  if (verdict.state === "issuing") {
    return { ok: true, state: "issuing", message: "Sertifikat sedang diterbitkan. Cek lagi sebentar." };
  }
  if (verdict.state === "elsewhere") {
    // Not a failure: this is the normal state of a domain that is verified but
    // whose DNS still points at its old host.
    return {
      ok: true,
      state: "elsewhere",
      message: "Domain ini masih dilayani pihak lain — arahkan DNS-nya ke sini dulu.",
    };
  }
  return { ok: false, state: "failed", message: verdict.reason };
}

/** Remove a domain this business registered. */
export async function removeCustomDomain(siteId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await mayManage(siteId))) return { ok: false, error: "Tidak diizinkan." };

  const admin = createAdminClient();
  const { data } = await admin.from("lp_sites").select("is_canonical").eq("id", siteId).maybeSingle();
  // The canonical site is where the panel itself lives; deleting it locks
  // everyone out of the thing they would use to undo it.
  if ((data as { is_canonical: boolean } | null)?.is_canonical) {
    return { ok: false, error: "Domain utama tidak bisa dihapus." };
  }

  const { error } = await admin.from("lp_sites").delete().eq("id", siteId);
  if (error) {
    console.error("removeCustomDomain:", error);
    return { ok: false, error: "Gagal menghapus domain." };
  }
  bustSiteCaches();
  return { ok: true };
}
