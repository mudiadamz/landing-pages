#!/usr/bin/env node
/**
 * Get certificates for customer domains before anyone visits them.
 *
 *   node --env-file-if-exists=.env.local --env-file-if-exists=.env.development.local \
 *     scripts/warm-domains.mjs
 *
 * From cron, every 15 minutes:
 *   0,15,30,45 * * * * cd /home/adam/work/landing-pages && \
 *     node --env-file-if-exists=.env.development.local scripts/warm-domains.mjs >> /tmp/warm-domains.log 2>&1
 *
 * (written out rather than the usual slash-15 form, which would close this
 * comment block — a comment that breaks the file is a poor place for a tip.)
 *
 * The panel's button covers the owner who is sitting there watching. This
 * covers the one who added the DNS records and went to bed: on-demand TLS
 * issues a certificate on the first HTTPS handshake for a host, so the sweep
 * makes that handshake itself and the first real visitor finds a certificate
 * already in place.
 *
 * Deliberately NOT the Caddy admin API. Pre-issuing "properly" means POSTing
 * hostnames into `apps.tls.certificates.automate` on the edge's admin endpoint,
 * which is loopback-only — it would have to be exposed across the internet and
 * then authenticated. That is a new credential and a new attack surface to
 * replace something a plain TLS connection already does.
 *
 * Safe to run on a schedule: every domain has its own backoff, healthy
 * certificates are skipped, and nothing here writes anything but the three
 * cert_* columns.
 */

import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

/** Let's Encrypt is a shared resource; one domain at a time, with a gap. */
const GAP_MS = 2_000;
const MAX_PER_RUN = 25;

const log = (...a) => console.log(new Date().toISOString(), ...a);

/**
 * The header the edge stamps on everything it serves (setup-edge.sh), and the
 * only thing here that answers the question actually being asked.
 *
 * Checking "is there a valid certificate for this host" is NOT the same
 * question, and the difference bit: a domain still pointed at its old host
 * presents a perfectly good certificate from whoever runs that host. The first
 * version of this script reported techgalery.com ready while its DNS still went
 * to Blogger.
 */
const EDGE_HEADER = "x-adm-edge";

async function probe(host, timeoutMs = 30_000) {
  try {
    const res = await fetch(`https://${host}/`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "adm-domain-check/1" },
    });
    return res.headers.get(EDGE_HEADER)
      ? { state: "ready" }
      : { state: "elsewhere", reason: "dilayani pihak lain" };
  } catch (e) {
    // A timeout usually means Caddy is mid-issuance, which is the expected
    // shape of a first attempt — not a failure worth recording.
    if (e.name === "TimeoutError" || e.name === "AbortError") return { state: "issuing" };
    const code = e.cause?.code;
    if (["ETIMEDOUT", "ECONNRESET", "EPROTO", "UND_ERR_CONNECT_TIMEOUT"].includes(code)) {
      return { state: "issuing" };
    }
    return { state: "failed", reason: code || e.message };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const connectionString = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!connectionString) {
    console.error("DATABASE_URL / MIGRATE_DATABASE_URL belum diset.");
    process.exit(2);
  }
  const db = new pg.Client({ connectionString });
  await db.connect();

  /**
   * Verified, and either never issued or close enough to expiry to be worth a
   * nudge. Caddy renews its own certificates in the background — this is the
   * net for when it cannot, not a replacement for it.
   */
  const { rows } = await db.query(
    `select id, host, cert_ready_at, cert_checked_at
       from lp_sites
      where verified_at is not null
        and active
        and (cert_ready_at is null or cert_ready_at < now() - interval '60 days')
        and (cert_checked_at is null or cert_checked_at < now() - interval '5 minutes')
      order by cert_ready_at nulls first, cert_checked_at nulls first
      limit $1`,
    [MAX_PER_RUN],
  );

  if (rows.length === 0) {
    if (VERBOSE) log("tidak ada domain yang perlu dihangatkan");
    await db.end();
    return;
  }

  log(`${rows.length} domain diperiksa${DRY_RUN ? " (dry run)" : ""}`);
  let ready = 0;
  let issuing = 0;
  let failed = 0;
  let elsewhere = 0;

  for (const row of rows) {
    if (DRY_RUN) {
      log(`  ${row.host}: akan dicoba`);
      continue;
    }
    const verdict = await probe(row.host);
    const now = new Date().toISOString();
    const patch = { cert_checked_at: now };
    if (verdict.state === "ready") {
      patch.cert_ready_at = now;
      patch.cert_error = null;
      ready += 1;
    } else if (verdict.state === "failed") {
      patch.cert_error = verdict.reason;
      failed += 1;
    } else if (verdict.state === "elsewhere") {
      // Verified but not cut over yet. Ordinary, not broken.
      patch.cert_error = null;
      elsewhere += 1;
    } else {
      patch.cert_error = null;
      issuing += 1;
    }

    const cols = Object.keys(patch);
    await db.query(
      `update lp_sites set ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} where id = $1`,
      [row.id, ...cols.map((c) => patch[c])],
    );
    log(`  ${row.host}: ${verdict.state}${verdict.reason ? ` — ${verdict.reason}` : ""}`);
    await sleep(GAP_MS);
  }

  log(`selesai: ${ready} siap, ${issuing} sedang terbit, ${elsewhere} masih di pihak lain, ${failed} gagal`);
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
