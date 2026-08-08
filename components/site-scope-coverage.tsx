/**
 * Says out loud what the numbers on this screen cover.
 *
 * Necessary because `site_id` was added to the event and purchase tables long after they
 * started filling up, and attribution cannot be back-filled — nothing recorded which of
 * our domains a visit or a payment landed on. So:
 *
 *   canonical site → its own rows PLUS every unattributed one (that is where they came
 *                    from: this deployment served one domain for that whole period)
 *   niche site     → its own rows only, which means it reads ZERO until new data
 *                    arrives under it
 *
 * That zero is the reason this component exists. An empty sales screen for a domain that
 * demonstrably has traffic looks exactly like a broken query, and a silent one would send
 * someone hunting a bug that is really a start date.
 */
export function SiteScopeCoverage({
  host,
  name,
  siteCount,
  includesUnattributed,
  what,
}: {
  host: string;
  name: string;
  siteCount: number;
  /** True on the canonical site, where pre-attribution rows are counted in. */
  includesUnattributed: boolean;
  /** What is being counted, lowercase: "penjualan", "kunjungan", "pesan". */
  what: string;
}) {
  if (siteCount < 2) return null;

  return (
    <p className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
      Hanya {what} dari <strong className="font-medium text-foreground">{name}</strong>{" "}
      <span className="font-mono text-foreground">{host}</span> · ganti di{" "}
      <strong className="font-medium text-foreground">Kelola situs</strong> pada sidebar.
      {includesUnattributed ? (
        <>
          {" "}
          Data lama (sebelum tiap domain dicatat) ikut dihitung di sini, karena dulu memang
          cuma ada domain ini.
        </>
      ) : (
        <>
          {" "}
          Angkanya mulai dari nol: {what} sebelum pencatatan per-domain tidak bisa
          diatribusikan ke belakang, jadi yang tampil hanya yang tercatat sejak fitur ini
          aktif.
        </>
      )}
    </p>
  );
}
