-- lp_profiles: grant kolom yang sesuai dengan apa yang memang dilakukan aplikasi.
--
-- Profil dijaga dua mekanisme yang terpisah: RLS memilih BARIS mana yang boleh
-- disentuh (milik sendiri), grant kolom memilih KOLOM mana yang boleh ditulis.
-- Policy UPDATE-nya sendiri cuma `auth.uid() = id`, tanpa batasan kolom — jadi
-- tanpa grant yang benar, "baris milik sendiri" berarti "account_type milik
-- sendiri" juga. Tiga hal yang salah dengan grant sebelum migration ini, semua
-- terbukti oleh tests/db/rls-profiles.test.ts:
--
-- 1. **avatar_url tidak pernah di-grant.** Kolomnya ditambahkan 20260809000000,
--    sebulan SESUDAH penguncian 20260713000000 (`grant update (full_name)`).
--    lib/actions/profiles.ts meng-update avatar_url lewat client user, jadi
--    ganti dan hapus avatar gagal dengan "permission denied" — file-nya sudah
--    terunggah ke Storage, profilnya tidak pernah menunjuk ke sana.
--
-- 2. **INSERT masih terbuka untuk semua kolom.** Policy INSERT mengizinkan user
--    membuat baris profilnya sendiri (dipakai fallback getProfile untuk akun yang
--    belum punya profil — misalnya warisan project texas-poker/planning-poker
--    yang memakai auth.users yang sama). Tapi grant-nya mencakup account_type,
--    plan, plan_expires_at, email_verified_at: akun tanpa profil bisa lahir
--    sebagai 'company', dengan paket berbayar, dan email "terverifikasi", cukup
--    dengan satu POST ke PostgREST.
--
-- 3. **anon memegang INSERT/UPDATE/DELETE/TRUNCATE.** Penguncian 2026-07-13
--    hanya menyentuh authenticated. Hari ini RLS menolak anon lebih dulu
--    (auth.uid() NULL), jadi ini lapis pertahanan yang bolong, bukan pintu yang
--    terbuka — tapi grant yang tidak pernah dimaksudkan untuk dipakai cuma satu
--    kesalahan policy dari dipakai.
--
-- Kolom lain (plan, account_type, is_active, email_verified_at, …) tetap hanya
-- bisa ditulis service role — yang memang satu-satunya jalur aplikasi untuk itu.
--
-- PERINGATAN untuk kolom berikutnya: grant di sini adalah DAFTAR, bukan
-- "semua kecuali". Kolom baru yang boleh ditulis user sendiri harus ditambahkan
-- ke grant di bawah, atau ia diam-diam gagal seperti avatar_url. Tesnya
-- (`setiap kolom lp_profiles sudah diputuskan`) sengaja merah sampai itu terjadi.

revoke insert, update, delete, truncate on public.lp_profiles from anon;

revoke insert on public.lp_profiles from authenticated;
grant  insert (id, full_name) on public.lp_profiles to authenticated;

-- full_name sudah di-grant oleh 20260713000000; ditulis ulang supaya daftar
-- lengkapnya bisa dibaca di satu tempat.
grant  update (full_name, avatar_url) on public.lp_profiles to authenticated;
