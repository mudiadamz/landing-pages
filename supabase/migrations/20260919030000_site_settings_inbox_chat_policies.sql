-- Tiga policy yang tidak cocok dengan aplikasinya, dibuktikan oleh
-- tests/db/rls-sites.test.ts, rls-private.test.ts, dan rls-chat.test.ts.

-- ---------------------------------------------------------------------------
-- 1. lp_site_settings: Agent situs itu boleh menyimpan setelan situsnya.
--
-- lib/actions/site-settings.ts menggerbang dengan requireSiteAdmin(siteId) /
-- requireFeature(...) — keduanya meloloskan Agent — lalu meng-upsert lewat
-- client USER. Policy-nya hanya mengizinkan Company, jadi setiap layar setelan
-- yang bisa dibuka Agent gagal saat disimpan: tracking & Tawk, harga/batas/
-- meta paket, link sosial, link lain, popup, hak akses peran, hero, konten,
-- legal, hiring, custom JS. Sisi "tulis" dari user berjenjang tidak pernah
-- jalan untuk Agent.
--
-- Aturannya sekarang persis canManageSite() di lib/site-membership.ts:
-- Company, atau Agent yang terdaftar di lp_site_agents UNTUK SITUS BARIS ITU.
-- Agent situs A tetap tidak bisa menyentuh baris situs B.
--
-- Yang TIDAK tertutup: customer yang diberi fitur lewat peta role_permissions.
-- requireFeature() meloloskannya, database tidak — mereplikasi peta itu di SQL
-- berarti menyalin logika yang hidup di lib/role-permissions.ts. Dicatat di
-- docs/plans/test-before-leaving-supabase.md sebagai celah yang diketahui.
-- ---------------------------------------------------------------------------
create or replace function public.lp_manages_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.lp_get_my_profile_role() = 'company', false)
      or exists (
           select 1 from public.lp_site_agents a
            where a.site_id = p_site_id and a.user_id = auth.uid()
         );
$$;

comment on function public.lp_manages_site(uuid) is
  'Pemanggil boleh mengurus situs ini: Company, atau Agent yang terdaftar untuk situs itu. Versi database dari canManageSite() di lib/site-membership.ts — keduanya harus sama.';

drop policy if exists "Admin can update site_settings" on public.lp_site_settings;
drop policy if exists "Admin can insert site_settings" on public.lp_site_settings;
drop policy if exists "Site managers update site_settings" on public.lp_site_settings;
drop policy if exists "Site managers insert site_settings" on public.lp_site_settings;

create policy "Site managers insert site_settings"
  on public.lp_site_settings for insert
  with check (public.lp_manages_site(site_id));

create policy "Site managers update site_settings"
  on public.lp_site_settings for update
  using (public.lp_manages_site(site_id))
  with check (public.lp_manages_site(site_id));

-- ---------------------------------------------------------------------------
-- 2. lp_received_emails: inbox support hanya lewat service role.
--
-- Policy lama: SELECT untuk `auth.role() = 'authenticated'` — SEMUA user
-- login. Gerbang requireFeature("inbox") ada di aplikasi, tapi satu panggilan
-- PostgREST dari browser customer mana pun mengembalikan seluruh inbox:
-- email masuk pelanggan, lengkap dengan isinya. Pembacaan di
-- lib/actions/received-emails.ts sekarang lewat service role di belakang
-- gerbang itu (sama dengan deleteReceivedEmail), jadi tabel ini bergabung
-- dengan tabel lain yang keamanannya berupa ketiadaan policy.
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated can read received_emails" on public.lp_received_emails;

-- ---------------------------------------------------------------------------
-- 3. Chat: menulis hanya ke percakapan sendiri.
--
-- Policy INSERT memeriksa penulis baris (auth.uid() = user_id), bukan milik
-- siapa sesi/pesan yang ditempeli. Orang bisa menyisipkan pesan ke sesi orang
-- lain, menempelkan lampiran ke pesannya, atau mengaitkan memori ke sesinya.
-- Route chat membaca lewat client user, jadi baris itu tidak sampai ke konteks
-- model korban — tapi tetap baris di percakapannya yang tidak bisa ia lihat
-- atau hapus.
-- ---------------------------------------------------------------------------
drop policy if exists "Users create own chat messages" on public.lp_chat_messages;
create policy "Users create own chat messages"
  on public.lp_chat_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lp_chat_sessions s
       where s.id = lp_chat_messages.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users create own chat attachments" on public.lp_chat_attachments;
create policy "Users create own chat attachments"
  on public.lp_chat_attachments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lp_chat_messages m
       where m.id = lp_chat_attachments.message_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Users create own chat memories" on public.lp_chat_memories;
create policy "Users create own chat memories"
  on public.lp_chat_memories for insert
  with check (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1 from public.lp_chat_sessions s
         where s.id = lp_chat_memories.session_id and s.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users update own chat memories" on public.lp_chat_memories;
create policy "Users update own chat memories"
  on public.lp_chat_memories for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1 from public.lp_chat_sessions s
         where s.id = lp_chat_memories.session_id and s.user_id = auth.uid()
      )
    )
  );
