-- Dua fungsi trigger SECURITY DEFINER yang belum mematok search_path.
--
-- Fungsi definer jalan dengan hak PEMILIK-nya tapi meresolusi nama tabel yang
-- tidak dikualifikasi lewat search_path PEMANGGIL. Pemanggil yang bisa menaruh
-- schema di depan `public` bisa menyelipkan tabel atau fungsinya sendiri dan
-- membuat fungsi ini — dengan hak pemilik — menyentuhnya. Semua fungsi definer
-- lp_ lainnya sudah mematoknya; dua ini tertinggal dari masa sebelum kebiasaan
-- itu ada. Dijaga oleh tests/db/rls-surface.test.ts.
--
-- Isinya tidak berubah: keduanya memang memaksudkan tabel di `public`.
alter function public.lp_update_landing_page_rating() set search_path = public;
alter function public.lp_update_landing_page_sold_count() set search_path = public;
