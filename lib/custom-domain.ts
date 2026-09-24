/* Rules for a domain a customer brings, kept away from the code that resolves
 * DNS so they can be tested without a network.
 *
 * Both shapes are supported, and they need DIFFERENT records:
 *
 *   shop.mereksendiri.com   CNAME → edge.mbahgpt.com    (a subdomain)
 *   mereksendiri.com        A     → <edge IP>           (the root domain)
 *
 * The split is not a preference, it is RFC 1034: the apex of a zone must carry
 * its SOA and NS records, and a CNAME may not coexist with anything — so a root
 * domain cannot be a CNAME. Handing an apex customer the CNAME instruction
 * produces an error at their registrar with no explanation from us, which is
 * why `dnsInstruction` exists rather than one copy of the text.
 *
 * The cost of the A record is real and worth saying out loud: it pins that
 * customer to one IP. Move the edge and every apex domain breaks at once, while
 * the CNAME ones follow by themselves. Some providers offer ALIAS/ANAME or
 * CNAME flattening at the apex, which gets the best of both; the check below
 * accepts that too, because from the outside it resolves to the same address.
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

export type DomainProblem = "empty" | "invalid" | "reserved" | "too-long";

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
  // The apex is allowed. It needs an A record rather than a CNAME, which is a
  // difference in INSTRUCTIONS (see dnsInstruction), not a reason to refuse.
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

export type DnsInstruction = {
  type: "A" | "CNAME";
  /** What to put in the record's name/host field. */
  name: string;
  value: string;
};

/**
 * The one record this customer has to create, given what kind of host it is.
 *
 * Returned as data rather than rendered text so the panel, the docs and any
 * future email all say the same thing — and so the apex/subdomain split is
 * decided once, here, instead of in each of them.
 */
export function dnsInstruction(host: string, target: string, edgeIp: string): DnsInstruction {
  return isApex(host)
    ? { type: "A", name: host, value: edgeIp }
    : { type: "CNAME", name: host, value: target };
}

/**
 * Does this host resolve to our edge?
 *
 * Asked of the resolved ADDRESSES, not of the record type, because that is the
 * one question with the same answer for every shape a customer might use: a
 * CNAME to the edge, an A record straight at it, or an apex flattened by their
 * provider all end at the same IP. Checking "is there a CNAME and does it match"
 * would report a correctly-configured apex as broken.
 */
export function pointsHere(addresses: string[], edgeIp: string): boolean {
  const want = edgeIp.trim();
  return want.length > 0 && addresses.some((a) => a.trim() === want);
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
