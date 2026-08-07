"use client";

import { useState } from "react";

/**
 * The steps this panel cannot do for you.
 *
 * Adding a row to lp_sites makes the app ready to serve a domain; it does not make
 * the domain reach the app, and it does not let anyone sign in on it. Those live in
 * Vercel and Supabase. Written per-domain with the real strings filled in, because
 * the failure mode is pasting a nearly-right URL and getting a redirect error with
 * no clue which of the three places is wrong.
 */

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          setDone(false);
        }
      }}
      className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-foreground"
    >
      {done ? "Tersalin" : "Copy"}
    </button>
  );
}

function Value({ children }: { children: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-md bg-[var(--card)] px-2 py-1">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
        {children}
      </code>
      <Copy value={children} />
    </span>
  );
}

function Step({
  n,
  title,
  where,
  children,
}: {
  n: number;
  title: string;
  where?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[11px] font-semibold text-[var(--primary)]">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-foreground">
          {title}
          {where && <span className="ml-1.5 font-normal text-[var(--muted)]">· {where}</span>}
        </p>
        <div className="space-y-1.5 text-xs text-[var(--muted)]">{children}</div>
      </div>
    </li>
  );
}

export function DomainSetupGuide({
  host,
  supabaseProjectUrl,
  canonicalHost,
  vercelAutomated,
}: {
  host: string;
  supabaseProjectUrl: string;
  canonicalHost: string;
  /** A token is configured, so the panel adds the domain to Vercel itself. */
  vercelAutomated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isSubdomain = host.endsWith(`.${canonicalHost}`);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            Langkah di luar panel ini
          </span>
          <span className="block text-xs text-[var(--muted)]">
            {vercelAutomated
              ? `Vercel sudah otomatis. Tinggal Supabase — tanpa itu, login di ${host} gagal.`
              : `Vercel & Supabase — tanpa ini, ${host} tidak bisa dibuka atau tidak bisa login.`}
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-[var(--primary)]">
          {open ? "Tutup" : "Buka"}
        </span>
      </button>

      {open && (
        <ol className="space-y-4 border-t border-[var(--border)] px-3 py-3">
          <Step
            n={1}
            title={
              vercelAutomated
                ? "Arahkan domain ke aplikasi — sudah otomatis"
                : "Arahkan domain ke aplikasi"
            }
            where="Vercel"
          >
            {vercelAutomated ? (
              <p>
                Panel ini menambahkannya sendiri lewat API Vercel saat domain dibuat — status &amp;
                tombolnya ada di kartu domain di atas. Kalau gagal, alasannya tampil di sana
                beserta tombol coba lagi.
              </p>
            ) : (
              <>
                <p>
                  Project <strong className="text-foreground">landing_pages</strong> → Settings →
                  Domains → <strong className="text-foreground">Add</strong>, lalu masukkan:
                </p>
                <Value>{host}</Value>
              </>
            )}
            {isSubdomain ? (
              <p>
                Ini subdomain <span className="font-mono">{canonicalHost}</span> yang DNS-nya
                sudah di Vercel — begitu ditambahkan, langsung jalan. SSL otomatis, tak perlu
                beli domain baru.
              </p>
            ) : (
              <p>
                Domain terpisah: Vercel akan menampilkan record DNS yang harus dipasang
                (nameserver atau A/CNAME) di registrar Anda. Ikuti yang Vercel tampilkan —
                jangan pakai nilai dari catatan lama, bisa berubah. SSL otomatis setelah
                terverifikasi.
              </p>
            )}
          </Step>

          <Step n={2} title="Izinkan login di domain ini" where="Supabase">
            <p>
              Authentication → URL Configuration →{" "}
              <strong className="text-foreground">Redirect URLs</strong> → Add URL:
            </p>
            <Value>{`https://${host}/auth/callback`}</Value>
            <p>
              Tanpa ini, tombol &ldquo;Masuk dengan Google&rdquo; di {host} gagal dengan error
              redirect. Sesi login <strong className="text-foreground">tidak</strong> lintas
              domain — pengunjung login sendiri di tiap domain, dan itu memang disengaja.
            </p>
            {isSubdomain && (
              <p>
                Untuk semua subdomain sekaligus, satu wildcard cukup (pemisahnya{" "}
                <span className="font-mono">.</span> dan <span className="font-mono">/</span>,
                jadi <span className="font-mono">*</span> hanya satu level):
                <span className="mt-1.5 block">
                  <Value>{`https://*.${canonicalHost}/auth/callback`}</Value>
                </span>
              </p>
            )}
          </Step>

          <Step n={3} title="Google — biasanya tidak perlu diubah" where="Google Cloud Console">
            <p>
              Login Google lewat Supabase memakai callback <em>milik Supabase</em>, bukan domain
              Anda. Jadi <strong className="text-foreground">Authorized redirect URIs</strong> di
              Google tetap satu nilai untuk semua domain:
            </p>
            <Value>{`${supabaseProjectUrl}/auth/v1/callback`}</Value>
            <p>
              Sudah terpasang sejak awal, jadi domain baru{" "}
              <strong className="text-foreground">tidak</strong> menambah pekerjaan di sini.
              Tambahkan <span className="font-mono">https://{host}</span> ke{" "}
              <em>Authorized JavaScript origins</em> hanya kalau nanti memakai Google One Tap
              (sekarang tidak).
            </p>
          </Step>

          <Step n={4} title="Cek" where={host}>
            <p>Buka domainnya dan pastikan tiga hal:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Homepage tampil dengan produk niche yang dipilih di atas.</li>
              <li>Tombol Masuk dengan Google berhasil dan tetap di domain ini.</li>
              <li>
                <span className="font-mono">/panel/purchases</span> bisa dibuka di domain ini —
                pembeli wajib bisa lihat pembeliannya di tempat dia beli. Layar admin
                (produk, domain, users) memantul ke{" "}
                <span className="font-mono">{canonicalHost}</span>.
              </li>
            </ul>
            <p>
              Pembayaran tidak perlu disetel apa pun: callback Duitku selalu ke{" "}
              <span className="font-mono">{canonicalHost}</span>, sedangkan pembeli dikembalikan
              ke domain tempat dia belanja.
            </p>
          </Step>
        </ol>
      )}
    </div>
  );
}
