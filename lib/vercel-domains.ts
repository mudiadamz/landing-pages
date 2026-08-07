/**
 * Adding a domain to the Vercel project from the panel, so step 2 of the setup
 * guide stops being a manual trip to another dashboard.
 *
 * OPTIONAL BY DESIGN. Without VERCEL_API_TOKEN every function reports
 * "not configured" and the panel falls back to the written instructions — the
 * feature degrades to what it was rather than breaking.
 *
 * Security: a Vercel access token is account- or team-scoped, not endpoint-scoped.
 * There is no "domains only" token, so this one can do anything the team can —
 * which is why it is a server-only env var (never NEXT_PUBLIC_), is read nowhere
 * but here, and every caller sits behind requireAdmin(). Give it an expiry and
 * scope it to the team, not "all resources".
 *
 * API: POST /v10/projects/{idOrName}/domains, POST .../domains/{domain}/verify.
 * https://vercel.com/docs/rest-api/projects/add-a-domain-to-a-project
 */

const API = "https://api.vercel.com";

export type VercelDomainState = {
  /** Present on the project. */
  added: boolean;
  /**
   * OWNERSHIP is settled — nobody else's Vercel account is holding the domain.
   *
   * This does NOT mean the domain works. A domain can be verified and still be
   * unreachable because its DNS doesn't point at Vercel; that is `dns` below.
   * Conflating the two is how a broken domain gets a green badge.
   */
  verified: boolean;
  /** TXT challenges for ownership — satisfy one, then call verify. */
  challenges: { type: string; domain: string; value: string; reason: string }[];
  /** DNS routing state. Null when it hasn't been looked up. */
  dns: VercelDnsConfig | null;
};

export type VercelDnsConfig = {
  /** True when Vercel can't route traffic and/or issue a certificate yet. */
  misconfigured: boolean;
  /** How Vercel currently sees it: "A" | "CNAME" | "http" | "dns-01" | null (not resolving). */
  configuredBy: string | null;
  /** Preferred A-record IPs (apex domains). */
  ipv4: string[];
  /** Preferred CNAME target (subdomains). Project-specific, never a fixed value. */
  cname: string | null;
};

export type VercelResult =
  | { ok: true; state: VercelDomainState }
  | { ok: false; error: string; code?: string };

/** Not configured is a normal state, not a failure — the panel says so and moves on. */
export function vercelConfigured(): boolean {
  return !!process.env.VERCEL_API_TOKEN && !!projectId();
}

function projectId(): string {
  // The linked project id, or its name — the API accepts either as idOrName.
  return process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME || "";
}

function teamQuery(): string {
  const team = process.env.VERCEL_TEAM_ID;
  return team ? `?teamId=${encodeURIComponent(team)}` : "";
}

async function call(
  path: string,
  init: RequestInit & { method: string },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    // Infrastructure state; never serve it from a cache.
    cache: "no-store",
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty body is fine for some statuses */
  }
  return { status: res.status, body };
}

function stateFrom(body: Record<string, unknown>): VercelDomainState {
  const challenges = Array.isArray(body.verification)
    ? (body.verification as VercelDomainState["challenges"])
    : [];
  return { added: true, verified: body.verified === true, challenges, dns: null };
}

/** rank=1 is Vercel's preferred value; fall back to the lowest rank present. */
function preferred<T>(list: unknown, pick: (v: unknown) => T | null): T | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const sorted = [...list].sort(
    (a, b) => Number((a as { rank?: number }).rank ?? 99) - Number((b as { rank?: number }).rank ?? 99),
  );
  for (const item of sorted) {
    const v = pick((item as { value?: unknown }).value);
    if (v !== null) return v;
  }
  return null;
}

/**
 * The records the registrar actually needs.
 *
 * Fetched, never hardcoded: the CNAME target is per-project (Vercel's docs show
 * values like `d1d4fc829fe7bc7c.vercel-dns-017.com`) and the recommended IPs
 * change. A pasted-in constant from a blog post is how a domain ends up pointing
 * at the wrong place and looking like our bug.
 */
export async function getVercelDnsConfig(host: string): Promise<VercelDnsConfig | null> {
  if (!vercelConfigured()) return null;
  const team = process.env.VERCEL_TEAM_ID;
  const qs = new URLSearchParams({ projectIdOrName: projectId() });
  if (team) qs.set("teamId", team);
  const { status, body } = await call(
    `/v6/domains/${encodeURIComponent(host)}/config?${qs.toString()}`,
    { method: "GET" },
  );
  if (status >= 400) return null;
  return {
    misconfigured: body.misconfigured === true,
    configuredBy: (body.configuredBy as string | null) ?? null,
    ipv4:
      preferred<string[]>(body.recommendedIPv4, (v) =>
        Array.isArray(v) ? (v as string[]).filter((x) => typeof x === "string") : null,
      ) ?? [],
    cname: preferred<string>(body.recommendedCNAME, (v) =>
      typeof v === "string" && v ? v : null,
    ),
  };
}

/**
 * Vercel's own message is usually better than anything invented here, but the
 * statuses that have a specific cause get a specific sentence — 409 in particular,
 * which means someone else's project holds the domain and no amount of retrying
 * will help.
 */
function errorFrom(status: number, body: Record<string, unknown>, host: string): string {
  const raw =
    typeof (body.error as { message?: string })?.message === "string"
      ? ((body.error as { message: string }).message)
      : "";
  switch (status) {
    case 401:
      return "Token Vercel ditolak (401). Cek VERCEL_API_TOKEN — mungkin kedaluwarsa.";
    case 402:
      return "Akun Vercel butuh pembaruan metode pembayaran (402).";
    case 403:
      return `Token tidak punya akses ke ${host} atau ke project ini (403). ${raw}`.trim();
    case 409:
      return `${host} sudah dipakai project/akun Vercel lain (409). Lepas dari sana dulu. ${raw}`.trim();
    case 400:
      return raw || `Vercel menolak ${host} (400) — domainnya tidak valid.`;
    default:
      return raw || `Vercel membalas ${status}.`;
  }
}

/**
 * Current state on the project, or added:false when Vercel doesn't have it.
 *
 * Also pulls the DNS config, because "on the project" and "reachable" are separate
 * facts and reporting only the first is what makes a dead domain look healthy.
 */
export async function getVercelDomain(host: string): Promise<VercelResult> {
  if (!vercelConfigured()) return { ok: false, error: "not-configured", code: "not-configured" };
  const { status, body } = await call(
    `/v9/projects/${encodeURIComponent(projectId())}/domains/${encodeURIComponent(host)}${teamQuery()}`,
    { method: "GET" },
  );
  if (status === 404) {
    return { ok: true, state: { added: false, verified: false, challenges: [], dns: null } };
  }
  if (status >= 400) return { ok: false, error: errorFrom(status, body, host) };
  const state = stateFrom(body);
  state.dns = await getVercelDnsConfig(host);
  return { ok: true, state };
}

export async function addVercelDomain(host: string): Promise<VercelResult> {
  if (!vercelConfigured()) return { ok: false, error: "not-configured", code: "not-configured" };
  const { status, body } = await call(
    `/v10/projects/${encodeURIComponent(projectId())}/domains${teamQuery()}`,
    { method: "POST", body: JSON.stringify({ name: host }) },
  );
  // Already on the project is success as far as the panel is concerned: the goal is
  // "Vercel serves this host", not "this exact call created it".
  if (status === 400 && /already/i.test(JSON.stringify(body))) return getVercelDomain(host);
  if (status >= 400) return { ok: false, error: errorFrom(status, body, host) };
  const state = stateFrom(body);
  state.dns = await getVercelDnsConfig(host);
  return { ok: true, state };
}

/**
 * Detach the domain from the project. Deliberately its OWN action rather than
 * something deleteSite does: this stops a live domain from serving, which is a
 * different intent from "remove this storefront's config", and is not what an
 * admin re-pointing a domain wants. Never called automatically.
 *
 * The domain stays owned by the team; only the project assignment goes.
 */
export async function removeVercelDomain(host: string): Promise<VercelResult> {
  if (!vercelConfigured()) return { ok: false, error: "not-configured", code: "not-configured" };
  const { status, body } = await call(
    `/v9/projects/${encodeURIComponent(projectId())}/domains/${encodeURIComponent(host)}${teamQuery()}`,
    { method: "DELETE" },
  );
  // Already gone is the desired end state, not an error.
  if (status === 404) return { ok: true, state: { added: false, verified: false, challenges: [], dns: null } };
  if (status >= 400) return { ok: false, error: errorFrom(status, body, host) };
  return { ok: true, state: { added: false, verified: false, challenges: [], dns: null } };
}

/** Ask Vercel to re-check the DNS challenge after the record has been added. */
export async function verifyVercelDomain(host: string): Promise<VercelResult> {
  if (!vercelConfigured()) return { ok: false, error: "not-configured", code: "not-configured" };
  const { status, body } = await call(
    `/v9/projects/${encodeURIComponent(projectId())}/domains/${encodeURIComponent(host)}/verify${teamQuery()}`,
    { method: "POST" },
  );
  if (status >= 400) return { ok: false, error: errorFrom(status, body, host) };
  return { ok: true, state: stateFrom(body) };
}
