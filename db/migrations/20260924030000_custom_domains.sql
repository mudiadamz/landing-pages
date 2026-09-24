-- Domain milik pelanggan sendiri, didaftarkan sendiri (self-service).
--
-- Sampai sekarang sebuah domain hanya bisa ditambahkan Platform: setiap fungsi
-- di lib/actions/sites.ts dijaga `requireAdmin()`, dan barisnya langsung
-- `active = true`. Itu benar selama semua domain memang milik kita sendiri.
-- Begitu sebuah business boleh mengarahkan `shop.mereksendiri.com` ke sini, dua
-- hal yang sebelumnya tidak ada jadi wajib:
--
--  1. **Bukti kepemilikan.** Tanpa itu siapa pun bisa mengklaim
--     `shop.pesaing.com`. Bukan karena dia lalu bisa menyajikan sesuatu di sana
--     — DNS-nya tetap bukan miliknya — tapi karena `lp_sites.host` UNIK, jadi
--     klaim palsu MENGUNCI pemilik aslinya dari mendaftarkan domainnya sendiri.
--     Itu serangan yang tidak butuh apa pun selain satu form.
--
--  2. **Pemisahan "ada" dari "boleh dilayani".** `active` sudah dipakai untuk
--     "matikan sementara storefront ini". Verifikasi adalah pertanyaan lain dan
--     butuh kolomnya sendiri: sebuah domain bisa terdaftar, belum terbukti, dan
--     karena itu belum boleh menerbitkan sertifikat.
--
-- Yang kedua itu penting untuk `/api/tls-check`. Endpoint itu memutuskan apakah
-- Caddy boleh meminta sertifikat Let's Encrypt untuk sebuah host, dan rate limit
-- Let's Encrypt dihitung PER AKUN. Selama jawabannya cuma "barisnya ada dan
-- aktif", satu orang yang mendaftarkan beberapa ratus domain asal-asalan bisa
-- menghabiskan jatah sertifikat semua storefront yang sah. Sesudah migration ini
-- jawabannya butuh `verified_at`.

alter table public.lp_sites
  -- Rahasia acak yang dipasang pemilik domain sebagai TXT di
  -- _adm-verify.<host>. Tetap disimpan sesudah terverifikasi: verifikasi ulang
  -- (domain pindah registrar, TXT terhapus) memakai token yang sama, dan
  -- menerbitkan token baru berarti instruksi yang sudah disalin orang jadi salah.
  add column if not exists verification_token text,
  -- NULL = belum terbukti. Ini yang dibaca /api/tls-check, bukan `active`.
  add column if not exists verified_at timestamptz,
  -- Apa yang kita suruh CNAME-kan, di-snapshot saat domain didaftarkan. Kalau
  -- suatu hari edge-nya pindah, baris lama tetap bisa menjelaskan instruksi yang
  -- dulu diberikan, alih-alih menampilkan target baru di sebelah DNS lama.
  add column if not exists dns_target text,
  add column if not exists last_check_at timestamptz,
  -- Alasan pemeriksaan terakhir gagal, apa adanya, untuk ditampilkan ke pemilik
  -- domain. "Gagal" tanpa sebab adalah tiket support.
  add column if not exists last_check_error text;

-- Domain yang sudah ada di sini adalah milik kita sendiri dan sudah melayani
-- trafik; menandainya belum terverifikasi akan mematikan penerbitan sertifikat
-- untuk domain yang hidup.
update public.lp_sites set verified_at = coalesce(verified_at, created_at, now());

grant insert(verification_token), update(verification_token) on table public.lp_sites to authenticated;
grant insert(verified_at), update(verified_at) on table public.lp_sites to authenticated;
grant insert(dns_target), update(dns_target) on table public.lp_sites to authenticated;
grant insert(last_check_at), update(last_check_at) on table public.lp_sites to authenticated;
grant insert(last_check_error), update(last_check_error) on table public.lp_sites to authenticated;

comment on column public.lp_sites.verified_at is
  'Kepemilikan domain terbukti lewat TXT di _adm-verify.<host>. NULL = belum — /api/tls-check menolak, jadi tidak ada sertifikat yang diminta untuk domain yang belum terbukti.';
comment on column public.lp_sites.verification_token is
  'Nilai acak yang harus muncul sebagai TXT di _adm-verify.<host>. Tidak diganti sesudah terverifikasi.';
