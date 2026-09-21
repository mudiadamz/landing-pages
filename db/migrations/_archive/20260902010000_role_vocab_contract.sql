-- Langkah 2 dari 2: pindahkan barisnya, lalu ketatkan lagi.
--
-- Dijalankan SESUDAH kode baru terpasang (lihat 20260902000000). Kode baru
-- membaca 'admin' maupun 'company', jadi migration ini tidak punya jendela di
-- mana ada orang kehilangan aksesnya.
--
--   lp_profiles.role      'admin' → 'company'
--   lp_site_members.role  'admin' → 'agent'
--
-- Nilai lain tidak disentuh: 'publisher' dan 'customer' sudah memakai kosakata
-- yang benar.

update public.lp_profiles     set role = 'company' where role = 'admin';
update public.lp_site_members set role = 'agent'   where role = 'admin';

-- CHECK: 'admin' tidak diterima lagi sebagai nilai BARU.
--
-- Yang tetap menerimanya adalah pembaca di sisi aplikasi (normalizeRole,
-- normalizeSiteRole), dan itu disengaja: baris yang entah bagaimana kembali
-- berisi 'admin' — restore backup lama, sunting manual di dashboard — harus
-- tetap dibaca sebagai Company/Agent, bukan diam-diam turun jadi Customer.
-- Menolaknya di sini mencegahnya MASUK; menerimanya di sana mencegah kerusakan
-- kalau ia terlanjur ada.
alter table public.lp_profiles drop constraint if exists lp_profiles_role_check;
alter table public.lp_profiles
  add constraint lp_profiles_role_check
  check (role in ('company', 'customer', 'publisher'));

alter table public.lp_site_members drop constraint if exists lp_site_members_role_check;
alter table public.lp_site_members
  add constraint lp_site_members_role_check
  check (role in ('agent', 'publisher', 'customer'));

comment on column public.lp_profiles.role is
  'Role tingkat PLATFORM: company | publisher | customer. "Company" = pemilik platform, lintas situs (buat/hapus situs, angkat Company lain, hapus akun). Role di dalam sebuah storefront ada di lp_site_members.role. Lihat docs/plans/hierarchical-users.md.';

comment on column public.lp_site_members.role is
  'Role DI SATU SITUS: agent | publisher | customer. Agent mengelola situs itu; publisher boleh menjual di situ; customer membeli.';
