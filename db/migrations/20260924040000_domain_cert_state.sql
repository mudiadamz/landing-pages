-- Sertifikat diterbitkan saat domain didaftarkan, bukan saat pengunjung datang.
--
-- On-demand TLS menerbitkan sertifikat pada permintaan HTTPS **pertama** untuk
-- sebuah domain. Itu yang membuat "arahkan DNS, selesai" bisa bekerja tanpa
-- mengedit apa pun — tapi harganya dibayar orang yang salah: permintaan pertama
-- menggantung 10–30 detik sementara Caddy bicara dengan Let's Encrypt, dan
-- kalau gagal yang melihat errornya adalah pengunjung, bukan pemilik toko.
--
-- Perbaikannya bukan mengganti mekanismenya, tapi memindahkan siapa yang
-- memicunya: begitu domain terverifikasi dan CNAME-nya sudah mengarah, KAMI
-- yang melakukan handshake pertama — dari tombol di panel, atau dari cron yang
-- menyapu domain yang belum siap. Pengunjung pertama datang ke sertifikat yang
-- sudah ada.
--
-- Tiga kolom, karena "siap" dan "sudah diperiksa" adalah dua hal berbeda dan
-- yang gagal butuh alasan yang bisa dibaca pemiliknya:

alter table public.lp_sites
  -- Handshake TLS ke domain ini berhasil dan sertifikatnya sah untuk host itu.
  -- NULL = belum pernah berhasil.
  add column if not exists cert_ready_at timestamptz,
  -- Kapan terakhir dicoba, berhasil atau tidak. Ini yang jadi dasar backoff:
  -- rate limit kegagalan validasi Let's Encrypt adalah 5 per hostname per jam,
  -- jadi tombol yang bisa ditekan berulang-ulang tanpa jeda adalah cara
  -- tercepat mengunci diri sendiri dari domain sendiri selama sejam.
  add column if not exists cert_checked_at timestamptz,
  add column if not exists cert_error text;

-- Domain yang sudah hidup sekarang memang sudah punya sertifikat — dari
-- Cloudflare, bukan dari edge ini. Sengaja TIDAK di-backfill: kolom ini berarti
-- "edge kita punya sertifikat untuk host ini", dan menandainya siap tanpa
-- pernah melakukan handshake adalah menuliskan sesuatu yang belum tentu benar.

grant insert(cert_ready_at), update(cert_ready_at) on table public.lp_sites to authenticated;
grant insert(cert_checked_at), update(cert_checked_at) on table public.lp_sites to authenticated;
grant insert(cert_error), update(cert_error) on table public.lp_sites to authenticated;

comment on column public.lp_sites.cert_ready_at is
  'Handshake TLS terakhir ke host ini berhasil dengan sertifikat yang sah. NULL = edge belum punya sertifikatnya.';
