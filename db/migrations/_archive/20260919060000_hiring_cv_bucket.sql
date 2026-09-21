-- Bucket hiring-cv akhirnya masuk version control.
--
-- app/api/hiring-test/route.ts mengunggah CV pelamar ke bucket ini sejak fitur
-- hiring ada, tapi bucket-nya dibuat TANGAN di dashboard produksi dan tidak
-- pernah ditulis di migration. Akibatnya setiap environment yang dibangun dari
-- migration — database lokal, CI, dan backend pengganti mana pun — tidak punya
-- bucket itu, dan /api/hiring-test gagal di langkah upload. Empat bucket lain
-- ada di migration; ini yang kelima.
--
-- Bentuknya mengikuti apa yang route itu tuntut: PDF saja, maksimal 5 MB,
-- dan PRIVAT — CV berisi nama, alamat, dan riwayat hidup orang. Route membaca &
-- menulisnya dengan service role dan membagikan signed URL 30 hari lewat email.
-- Tidak ada storage policy: sama seperti publisher-kyc, tidak seorang pun
-- boleh menyentuhnya lewat API publik.
--
-- `on conflict do update`, bukan `do nothing`: di produksi bucket ini sudah ada,
-- dengan setelan yang dipilih tangan dan tidak pernah dicatat. Menimpanya ke
-- bentuk yang tertulis di sini adalah intinya — terutama `public = false`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hiring-cv', 'hiring-cv', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
