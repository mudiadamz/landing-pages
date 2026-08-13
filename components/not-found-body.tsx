import Link from "next/link";

/**
 * The 404 body. One component, two mounts: app/not-found.tsx (for whatever Next
 * routes there) and /not-found-page, which the proxy rewrites to when it knows a
 * record is missing — that rewrite is what carries a real 404 status.
 */
export function NotFoundBody() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center text-foreground">
      <p className="font-mono text-sm tracking-[0.3em] text-[var(--muted)]">404</p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        Alamatnya mungkin salah ketik, atau halamannya sudah dipindah. Tidak ada yang
        rusak di pihak Anda.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          Ke beranda
        </Link>
        <Link
          href="/categories"
          className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-subtle)] px-5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15"
        >
          Lihat kategori
        </Link>
        <Link
          href="/contact"
          className="flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-foreground"
        >
          Hubungi kami
        </Link>
      </div>
    </div>
  );
}
