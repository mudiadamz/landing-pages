-- lp_track_session: satu tanda tangan, dan hanya service role yang memanggil.
--
-- 1. Overload lama (tanpa p_site_id) tertinggal dari 20260808050000, yang
--    menambahkan parameter baru dengan membuat fungsi kedua alih-alih mengganti
--    yang lama. Aplikasi hari ini selalu mengirim p_site_id, jadi hanya overload
--    baru yang cocok — tapi pemanggil mana pun yang melewatkan p_site_id akan
--    mendapat "could not choose the best candidate function" dari PostgREST,
--    dan kunjungannya hilang tanpa jejak. Overload lama tidak dipakai siapa pun.
--
-- 2. Fungsi ini SECURITY DEFINER dan bisa dipanggil anon & user login lewat
--    /rest/v1/rpc. Kunjungan seharusnya dicatat /api/analytics dengan service
--    role, SESUDAH route itu menentukan IP dan situsnya sendiri. Lewat RPC
--    langsung, siapa pun bisa menulis sesi dengan IP, negara, UTM, dan bahkan
--    p_user_id pilihannya — mengarang lalu lintas atas nama user lain.
--
-- Dijaga oleh tests/db/logic.test.ts.

drop function if exists public.lp_track_session(
  text, text, uuid, text, text, text, text, text, text, text, text, uuid,
  text, text, text, text, text, text, text, text, bigint
);

revoke execute on function public.lp_track_session(
  text, text, uuid, text, text, text, text, text, text, text, text, uuid,
  text, text, text, text, text, text, text, text, bigint, uuid
) from public, anon, authenticated;

grant execute on function public.lp_track_session(
  text, text, uuid, text, text, text, text, text, text, text, text, uuid,
  text, text, text, text, text, text, text, text, bigint, uuid
) to service_role;
