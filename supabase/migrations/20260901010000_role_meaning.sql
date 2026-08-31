-- Fase 7 dari docs/plans/hierarchical-users.md: mempersempit ARTI kolomnya.
--
-- Tidak ada perubahan bentuk — nilainya tetap admin/publisher/customer. Yang
-- berubah adalah apa yang dijanjikannya, dan itu perlu tertulis di tempat orang
-- berikutnya membacanya: di databasenya sendiri, bukan hanya di dokumen.

comment on column public.lp_profiles.role is
  'Role tingkat PLATFORM. Sejak lp_site_members ada, ini hanya menjawab "apakah dia platform admin" (lintas situs: buat/hapus situs, angkat platform admin, hapus akun). Role di dalam sebuah storefront ada di lp_site_members.role. Lihat docs/plans/hierarchical-users.md.';

comment on column public.lp_profiles.publisher_status is
  'Status verifikasi identitas, tingkat PLATFORM dan sengaja bukan per-situs: KTP, selfie, dan rekening bank itu milik orangnya, bukan milik satu storefront. Sekali disetujui, berlaku di mana pun dia jadi anggota.';
