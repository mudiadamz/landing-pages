/* Rules for a domain a customer brings, kept away from the code that resolves
 * DNS so they can be tested without a network.
 *
 * The shape we accept is narrow on purpose: a SUBDOMAIN of a domain the
 * customer owns (`shop.mereksendiri.com`), pointed here with a CNAME.
 *
 * Why not the apex (`mereksendiri.com`):
 *   - a CNAME is illegal at the apex (RFC 1034 — the apex must carry SOA/NS),
 *     so an apex customer needs an A record, which pins them to an IP we then
 *     can never change without breaking every one of them at once;
 *   - the workarounds (ALIAS / ANAME / CNAME flattening) exist at maybe a third
 *     of registrars, and the ones that lack it produce a support ticket that
 *     ends in "your registrar cannot do this".
 * A subdomain has none of that: CNAME works everywhere, and the target can move.
 */

/** Where the proof lives: a TXT record on this label under their domain. */
export const VERIFY_PREFIX = "_adm-verify";

/** The TXT value's prefix, so a record meant for us is recognisable as ours. */
export const VERIFY_VALUE_PREFIX = "adm-verify=";

/**
 * Suffixes that are registrable at the second level, so `merek.co.id` is an
 * apex even though it has three labels.
 *
 * A deliberate approximation of the Public Suffix List: the full list is ~10k
 * entries that need updating, and getting it wrong in the SAFE direction here
 * only means rejecting a domain we could have accepted — a message the customer
 * can act on — while getting it wrong the other way means accepting an apex
 * that will then fail at their registrar with no explanation from us.
 *
 * Indonesian second-levels first, because that is who is being onboarded.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  "co.id", "or.id", "web.id", "my.id", "biz.id", "ac.id", "sch.id", "go.id", "net.id", "desa.id",
  "co.uk", "org.uk", "me.uk", "com.au", "net.au", "org.au", "co.nz", "com.sg", "com.my",
  "co.jp", "com.br", "com.mx", "co.za", "com.tr", "com.ph", "co.th", "com.vn", "com.hk",
]);

export type DomainProblem =
  | "empty"
  | "invalid"
  | "apex"
  | "reserved"
  | "too-long";

/** Hosts nobody else may claim, whatever their DNS says. */
const RESERVED = new Set(["localhost", "mbahgpt.com", "www.mbahgpt.com"]);

/**
 * A host as we will store it: lowercase, no scheme, no port, no path, no
 * trailing dot.
 *
 * Accepts what people actually paste — `https://Shop.Merek.com/` — because the
 * alternative is an error message about a format they were never shown.
 */
export function normalizeCustomHost(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split("/")[0]
    .split("?")[0]
    .split(":")[0]
    .replace(/\.+$/, "");
}

/** The registrable part: `shop.merek.co.id` → `merek.co.id`. */
export function registrableDomain(host: string): string {
  const labels = host.split(".");
  if (labels.length < 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3) return labels.slice(-3).join(".");
  return lastTwo;
}

/** True when `host` is the registrable domain itself, i.e. has no subdomain. */
export function isApex(host: string): boolean {
  return host === registrableDomain(host);
}

/**
 * Why we cannot accept this host, or null when we can.
 *
 * Returns the reason rather than a boolean so the panel can say which rule was
 * broken. "Domain tidak valid" on its own is the message that generates the
 * support ticket this function exists to prevent.
 */
export function customHostProblem(host: string): DomainProblem | null {
  if (!host) return "empty";
  if (host.length > 253) return "too-long";
  // Labels: 1–63 chars, alphanumerics and hyphens, not starting or ending with
  // one. At least two labels, and a TLD that is letters only.
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) {
    return "invalid";
  }
  if (RESERVED.has(host)) return "reserved";
  if (isApex(host)) return "apex";
  return null;
}

/** The hostname the customer must create the TXT record on. */
export function verificationHost(host: string): string {
  return `${VERIFY_PREFIX}.${host}`;
}

/** The exact TXT value we will look for. */
export function verificationValue(token: string): string {
  return `${VERIFY_VALUE_PREFIX}${token}`;
}

/**
 * Does this set of TXT strings contain our proof?
 *
 * A resolver returns each record as an array of chunks (TXT is stored in
 * 255-byte pieces), so the chunks are joined before comparing — a token split
 * across two chunks is otherwise a verification that fails for a record that is
 * perfectly correct. Other records on the same name are ignored rather than
 * treated as a conflict: a domain legitimately carries SPF, DMARC and every
 * other vendor's proof at once.
 */
export function txtMatches(records: string[][], token: string): boolean {
  const wanted = verificationValue(token);
  return records.some((chunks) => {
    const joined = chunks.join("").trim().replace(/^"|"$/g, "");
    return joined === wanted;
  });
}

/**
 * Is the CNAME pointing here?
 *
 * Compared case-insensitively and without the trailing dot a resolver returns.
 * Only used to TELL the customer where they are; it is never what authorises a
 * domain — that is the TXT record, and only the TXT record.
 */
export function cnameMatches(values: string[], target: string): boolean {
  const want = normalizeCustomHost(target);
  return values.some((v) => normalizeCustomHost(v) === want);
}

export type DomainState = "unverified" | "verified" | "live";

/**
 * What to show the owner, from the three facts we have.
 *
 * "live" needs both halves: proof of ownership AND traffic actually arriving.
 * Separating them matters because they fail for different reasons and have
 * different fixes — a missing TXT is one record, a missing CNAME is another,
 * and telling someone "not working" when half of it is would send them to
 * re-check the half that was already right.
 */
export function domainState(input: {
  verifiedAt: string | null;
  cnameOk: boolean;
}): DomainState {
  if (!input.verifiedAt) return "unverified";
  return input.cnameOk ? "live" : "verified";
}
