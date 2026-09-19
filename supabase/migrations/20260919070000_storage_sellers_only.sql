-- Unggahan ke bucket penjual hanya untuk penjual.
--
-- landing-assets adalah bucket PUBLIK yang sengaja menerima SEMUA jenis file
-- sampai 50 MB — bundle situs membawa HTML, CSS, JS, font. Policy unggahnya
-- berlaku untuk SETIAP user login di foldernya sendiri, jadi akun customer mana
-- pun bisa memakai domain storage proyek ini sebagai hosting gratis: halaman
-- phishing, file apa pun, dengan URL publik permanen.
--
-- Satu-satunya jalur aplikasi yang mengunggah ke bucket ini lewat client user
-- adalah lib/upload-client.ts, dipakai form produk di panel — penjual. Avatar
-- lewat service role (lib/actions/profiles.ts). landing-downloads sama: diisi
-- form produk. Jadi syaratnya lp_can_sell() (20260919020000) — Company, Agent,
-- atau publisher di salah satu situs — sama dengan syarat membuat produk.
--
-- Menghapus miliknya sendiri tidak diubah: penjual yang izin jualnya dicabut
-- tetap boleh membersihkan file yang pernah ia unggah.
--
-- Dijaga oleh tests/db/storage-http.test.ts dan rls-storage.test.ts.

drop policy if exists "Users can upload own assets" on storage.objects;
create policy "Users can upload own assets"
  on storage.objects for insert
  with check (
    bucket_id = 'landing-assets'
    and (auth.uid())::text = (storage.foldername(name))[1]
    and public.lp_can_sell()
  );

drop policy if exists "Users can update own assets" on storage.objects;
create policy "Users can update own assets"
  on storage.objects for update
  using (
    bucket_id = 'landing-assets'
    and (auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'landing-assets'
    and (auth.uid())::text = (storage.foldername(name))[1]
    and public.lp_can_sell()
  );

drop policy if exists "Users can upload downloads in own folder" on storage.objects;
create policy "Users can upload downloads in own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'landing-downloads'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and public.lp_can_sell()
  );
