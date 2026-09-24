/* Is this domain actually being served, with HTTPS, BY US?
 *
 * The decisions live here, away from the socket, so they can be tested without
 * one. `probeDomain` in lib/actions/domains.ts does the I/O and asks these
 * functions what the answer means.
 *
 * Why a request rather than Caddy's admin API. Pre-issuing "properly" means
 * POSTing the hostname into `apps.tls.certificates.automate` on the edge's
 * admin endpoint — which is loopback-only by default, so it would have to be
 * exposed across the internet and then authenticated. That is a new credential
 * and a new attack surface, to replace something a plain HTTPS request already
 * does: on-demand TLS issues on the first handshake, and nothing says the first
 * handshake has to come from a customer. So we make it.
 *
 * WHY THE HEADER, and not just "did TLS succeed". The first version of this
 * checked only that the certificate was valid and covered the host — and
 * reported `techgalery.com` ready while its DNS still pointed at Blogger.
 * Google serves a perfectly valid certificate for it; so does Cloudflare for
 * mbahgpt.com. A valid certificate proves somebody is serving the domain, not
 * that WE are. The edge stamps every response with `x-adm-edge`, and that is
 * the only thing here that actually answers the question being asked.
 */

/** The response header the edge adds to everything it serves (see setup-edge.sh). */
export const EDGE_HEADER = "x-adm-edge";

export type DomainVerdict =
  | { state: "ready" }
  /** Reachable over HTTPS, but the answer came from somewhere that is not us. */
  | { state: "elsewhere" }
  /** No answer yet — usually Caddy mid-issuance, which is a first attempt's normal shape. */
  | { state: "issuing" }
  | { state: "failed"; reason: string };

/**
 * What a completed HTTPS request means.
 *
 * `elsewhere` is its own state rather than a failure, because it is the
 * ordinary condition of a domain that has been verified but not cut over yet —
 * and telling that owner their domain "failed" would be both wrong and alarming.
 */
export function verdictFromResponse(headers: {
  get(name: string): string | null;
}): DomainVerdict {
  return headers.get(EDGE_HEADER) ? { state: "ready" } : { state: "elsewhere" };
}

/**
 * A connection error that means "still working on it" rather than "broken".
 *
 * Caddy holds the handshake open while it talks to Let's Encrypt, so the very
 * request that TRIGGERS issuance is also the one most likely to time out. That
 * is the expected shape of a first attempt, not a failure to report — calling
 * it a failure would tell an owner their domain is broken at the exact moment
 * it is being set up.
 */
export function isIssuingError(code: string | undefined): boolean {
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EPROTO" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "ERR_SOCKET_CONNECTION_TIMEOUT"
  );
}

/**
 * Backoff between attempts on a domain that is not ready.
 *
 * Let's Encrypt allows 5 FAILED validations per hostname per hour. A button
 * anyone can press has to be slower than that, or the first impatient owner
 * locks their own domain out for an hour — which looks exactly like our bug.
 * Five minutes gives at most 12 attempts an hour, of which only the failures
 * count, and leaves room for the cron sweep to run alongside.
 */
export const CERT_RETRY_MS = 5 * 60_000;

export function mayRetry(
  lastCheckedAt: string | null,
  now = new Date(),
  backoffMs = CERT_RETRY_MS,
): boolean {
  if (!lastCheckedAt) return true;
  const last = new Date(lastCheckedAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= backoffMs;
}

/** Seconds left before another attempt is allowed. 0 = now. */
export function retryAfterSeconds(
  lastCheckedAt: string | null,
  now = new Date(),
  backoffMs = CERT_RETRY_MS,
): number {
  if (mayRetry(lastCheckedAt, now, backoffMs)) return 0;
  const last = new Date(lastCheckedAt as string).getTime();
  return Math.ceil((backoffMs - (now.getTime() - last)) / 1000);
}

/**
 * Should the sweeper touch this domain at all?
 *
 * Verified, and either never served by us or last confirmed long enough ago
 * that a renewal should have happened since. Caddy renews its own certificates
 * in the background, so this is a safety net for the case it cannot — and a net
 * that pulls on everything every hour is just load.
 */
export const CERT_RECHECK_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

export function needsWarming(
  row: { verifiedAt: string | null; certReadyAt: string | null },
  now = new Date(),
): boolean {
  if (!row.verifiedAt) return false;
  if (!row.certReadyAt) return true;
  const last = new Date(row.certReadyAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= CERT_RECHECK_AFTER_MS;
}
