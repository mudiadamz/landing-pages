-- =====================================================================
-- verify.sql — post-merge assertions for the 3-project Supabase merge.
--
-- Run AFTER applying all migrations (pp_merge, tp_merge, lp_rename), e.g.:
--   cd landing_pages && supabase start && supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f ../verify.sql
-- or against any target:
--   psql "$DB_URL" -f verify.sql
--
-- Prints a PASS/FAIL row per check, a summary, and RAISEs an exception
-- (non-zero exit) if any check failed — so it doubles as a CI gate.
--
-- The realtime-publication checks require the `supabase_realtime`
-- publication (present after `supabase db reset` and on hosted Supabase);
-- a precheck flags it if absent.
-- =====================================================================

\set ON_ERROR_STOP on

drop table if exists _verify;
create temporary table _verify(category text, check_name text, ok boolean);

insert into _verify (category, check_name, ok)

-- ---------- Tables present ----------
select 'tables', 'pp_rooms exists',                 to_regclass('public.pp_rooms')                is not null union all
select 'tables', 'pp_players exists',               to_regclass('public.pp_players')              is not null union all
select 'tables', 'pp_voting_rounds exists',         to_regclass('public.pp_voting_rounds')        is not null union all
select 'tables', 'tp_rooms exists',                 to_regclass('public.tp_rooms')                is not null union all
select 'tables', 'tp_players exists',               to_regclass('public.tp_players')              is not null union all
select 'tables', 'tp_profiles exists',              to_regclass('public.tp_profiles')             is not null union all
select 'tables', 'tp_app_settings exists',          to_regclass('public.tp_app_settings')         is not null union all
select 'tables', 'lp_landing_pages exists',         to_regclass('public.lp_landing_pages')        is not null union all
select 'tables', 'lp_landing_page_versions exists', to_regclass('public.lp_landing_page_versions') is not null union all
select 'tables', 'lp_profiles exists',              to_regclass('public.lp_profiles')             is not null union all
select 'tables', 'lp_purchases exists',             to_regclass('public.lp_purchases')            is not null union all
select 'tables', 'lp_contacts exists',              to_regclass('public.lp_contacts')             is not null union all
select 'tables', 'lp_landing_page_categories exists', to_regclass('public.lp_landing_page_categories') is not null union all
select 'tables', 'lp_received_emails exists',       to_regclass('public.lp_received_emails')      is not null union all
select 'tables', 'lp_site_settings exists',         to_regclass('public.lp_site_settings')        is not null union all
select 'tables', 'lp_reviews exists',               to_regclass('public.lp_reviews')              is not null union all

-- ---------- Old unprefixed names removed ----------
select 'old-removed', 'public.rooms gone',                 to_regclass('public.rooms')                 is null union all
select 'old-removed', 'public.players gone',               to_regclass('public.players')               is null union all
select 'old-removed', 'public.profiles gone',              to_regclass('public.profiles')              is null union all
select 'old-removed', 'public.voting_rounds gone',         to_regclass('public.voting_rounds')         is null union all
select 'old-removed', 'public.app_settings gone',          to_regclass('public.app_settings')          is null union all
select 'old-removed', 'public.landing_pages gone',         to_regclass('public.landing_pages')         is null union all
select 'old-removed', 'public.landing_page_versions gone', to_regclass('public.landing_page_versions') is null union all
select 'old-removed', 'public.landing_page_categories gone', to_regclass('public.landing_page_categories') is null union all
select 'old-removed', 'public.purchases gone',             to_regclass('public.purchases')             is null union all
select 'old-removed', 'public.contacts gone',              to_regclass('public.contacts')              is null union all
select 'old-removed', 'public.received_emails gone',       to_regclass('public.received_emails')       is null union all
select 'old-removed', 'public.site_settings gone',         to_regclass('public.site_settings')         is null union all
select 'old-removed', 'public.reviews gone',               to_regclass('public.reviews')               is null union all

-- ---------- Reconstructed texas columns (the lost-DB recoveries) ----------
select 'tp-columns', 'tp_players.last_action is text',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='tp_players'
           and column_name='last_action' and data_type='text') union all
select 'tp-columns', 'tp_players.last_action_amount is bigint',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='tp_players'
           and column_name='last_action_amount' and data_type='bigint') union all
select 'tp-columns', 'tp_profiles.current_session_id is text',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='tp_profiles'
           and column_name='current_session_id' and data_type='text') union all
select 'tp-columns', 'tp_app_settings.buy_in_bb is integer',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='tp_app_settings'
           and column_name='buy_in_bb' and data_type='integer') union all
select 'tp-columns', 'tp_app_settings has all 5 setting columns',
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='tp_app_settings'
       and column_name in ('action_timeout_seconds','between_hand_seconds',
                           'showdown_seconds','reveal_seconds','buy_in_bb')) = 5 union all

-- ---------- tp_app_settings singleton seed ----------
select 'tp-seed', 'tp_app_settings has exactly one row',
  (select count(*) from public.tp_app_settings) = 1 union all
select 'tp-seed', 'tp_app_settings id=1 row has expected defaults',
  exists(select 1 from public.tp_app_settings
         where id=1 and action_timeout_seconds=45 and between_hand_seconds=5
           and showdown_seconds=20 and reveal_seconds=3 and buy_in_bb=100) union all

-- ---------- Functions: texas client RPCs ----------
select 'tp-funcs', 'tp_start_hand exists',            to_regproc('public.tp_start_hand')            is not null union all
select 'tp-funcs', 'tp_player_action exists',         to_regproc('public.tp_player_action')         is not null union all
select 'tp-funcs', 'tp_apply_showdown_winners exists', to_regproc('public.tp_apply_showdown_winners') is not null union all
select 'tp-funcs', 'tp_advance_phase exists',         to_regproc('public.tp_advance_phase')         is not null union all
select 'tp-funcs', 'tp_claim_session exists (recovered)', to_regproc('public.tp_claim_session')     is not null union all
select 'tp-funcs', 'tp_claim_welcome_bonus exists',   to_regproc('public.tp_claim_welcome_bonus')   is not null union all
select 'tp-funcs', 'tp_spin_wheel exists',            to_regproc('public.tp_spin_wheel')            is not null union all
select 'tp-funcs', 'tp_claim_daily_bonus exists',     to_regproc('public.tp_claim_daily_bonus')     is not null union all
select 'tp-funcs', 'tp_timing_settings exists',       to_regproc('public.tp_timing_settings')       is not null union all
select 'tp-funcs', 'tp_action_timeout exists',        to_regproc('public.tp_action_timeout')        is not null union all
select 'tp-funcs', 'tp_end_showdown exists',          to_regproc('public.tp_end_showdown')          is not null union all
select 'tp-funcs', 'tp_* function count >= 30',
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname ~ '^tp_') >= 30 union all

-- ---------- Functions: planning-poker RPCs ----------
select 'pp-funcs', 'pp_reveal_room exists',           to_regproc('public.pp_reveal_room')           is not null union all
select 'pp-funcs', 'pp_reset_room exists',            to_regproc('public.pp_reset_room')            is not null union all
select 'pp-funcs', 'pp_kick_player exists',           to_regproc('public.pp_kick_player')           is not null union all
select 'pp-funcs', 'pp_transfer_room_ownership exists', to_regproc('public.pp_transfer_room_ownership') is not null union all
select 'pp-funcs', 'pp_update_room_deck exists',      to_regproc('public.pp_update_room_deck')      is not null union all
select 'pp-funcs', 'pp_current_room_owner exists',    to_regproc('public.pp_current_room_owner')    is not null union all
select 'pp-funcs', 'pp_is_room_owner exists',         to_regproc('public.pp_is_room_owner')         is not null union all

-- ---------- Functions: landing (renamed) ----------
select 'lp-funcs', 'lp_handle_new_user exists',              to_regproc('public.lp_handle_new_user')              is not null union all
select 'lp-funcs', 'lp_set_updated_at exists',               to_regproc('public.lp_set_updated_at')               is not null union all
select 'lp-funcs', 'lp_update_landing_page_sold_count exists', to_regproc('public.lp_update_landing_page_sold_count') is not null union all
select 'lp-funcs', 'lp_get_my_profile_role exists',          to_regproc('public.lp_get_my_profile_role')          is not null union all
select 'lp-funcs', 'lp_update_landing_page_rating exists',   to_regproc('public.lp_update_landing_page_rating')   is not null union all
select 'lp-funcs', 'old public.handle_new_user gone',        to_regproc('public.handle_new_user')                 is null union all
select 'lp-funcs', 'old public.update_landing_page_rating gone', to_regproc('public.update_landing_page_rating')  is null union all

-- ---------- Triggers ----------
select 'triggers', 'tp_on_auth_user_created on auth.users',
  exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
         where t.tgname='tp_on_auth_user_created' and n.nspname='auth' and c.relname='users' and not t.tgisinternal) union all
select 'triggers', 'landing auth trigger calls lp_handle_new_user',
  exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
         join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='auth' and c.relname='users' and p.proname='lp_handle_new_user' and not t.tgisinternal) union all
select 'triggers', 'texas auth trigger calls tp_handle_new_user',
  exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
         join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='auth' and c.relname='users' and p.proname='tp_handle_new_user' and not t.tgisinternal) union all
select 'triggers', 'tp_players_assign_seat exists',
  exists(select 1 from pg_trigger where tgname='tp_players_assign_seat' and not tgisinternal) union all
select 'triggers', 'tp_players_default_chips exists',
  exists(select 1 from pg_trigger where tgname='tp_players_default_chips' and not tgisinternal) union all
select 'triggers', 'tp_players_waiting_timer exists',
  exists(select 1 from pg_trigger where tgname='tp_players_waiting_timer' and not tgisinternal) union all
select 'triggers', 'tp_profiles_touch exists',
  exists(select 1 from pg_trigger where tgname='tp_profiles_touch' and not tgisinternal) union all
select 'triggers', 'lp_landing_pages_updated_at exists',
  exists(select 1 from pg_trigger where tgname='lp_landing_pages_updated_at' and not tgisinternal) union all
select 'triggers', 'lp_purchases_sold_count_trigger exists',
  exists(select 1 from pg_trigger where tgname='lp_purchases_sold_count_trigger' and not tgisinternal) union all
select 'triggers', 'lp_reviews_rating_trigger exists',
  exists(select 1 from pg_trigger where tgname='lp_reviews_rating_trigger' and not tgisinternal) union all

-- ---------- RLS policies ----------
select 'rls', 'tp_profiles_self_read policy',
  exists(select 1 from pg_policies where schemaname='public' and tablename='tp_profiles' and policyname='tp_profiles_self_read') union all
select 'rls', 'tp_app_settings_read_all policy',
  exists(select 1 from pg_policies where schemaname='public' and tablename='tp_app_settings' and policyname='tp_app_settings_read_all') union all
select 'rls', 'tp_rooms_select_all policy',
  exists(select 1 from pg_policies where schemaname='public' and tablename='tp_rooms' and policyname='tp_rooms_select_all') union all
select 'rls', 'tp_players_anon_all policy',
  exists(select 1 from pg_policies where schemaname='public' and tablename='tp_players' and policyname='tp_players_anon_all') union all
select 'rls', 'pp_rooms_select_all policy',
  exists(select 1 from pg_policies where schemaname='public' and tablename='pp_rooms' and policyname='pp_rooms_select_all') union all
select 'rls', 'pp_players_anon_all policy',
  exists(select 1 from pg_policies where schemaname='public' and tablename='pp_players' and policyname='pp_players_anon_all') union all
select 'rls', 'tp_profiles RLS enabled',
  coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relname='tp_profiles'), false) union all

-- ---------- Realtime publication membership ----------
select 'realtime', 'supabase_realtime publication exists',
  exists(select 1 from pg_publication where pubname='supabase_realtime') union all
select 'realtime', 'pp_rooms in supabase_realtime',
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pp_rooms') union all
select 'realtime', 'pp_players in supabase_realtime',
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pp_players') union all
select 'realtime', 'tp_rooms in supabase_realtime',
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tp_rooms') union all
select 'realtime', 'tp_players in supabase_realtime',
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tp_players') union all
select 'realtime', 'tp_profiles in supabase_realtime',
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tp_profiles') union all
select 'realtime', 'tp_app_settings in supabase_realtime',
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tp_app_settings') union all

-- ---------- Constraints ----------
select 'constraints', 'tp_rooms_blinds_ratio_chk (recovered)',
  exists(select 1 from pg_constraint where conname='tp_rooms_blinds_ratio_chk') union all
select 'constraints', 'tp_players_room_seat_unique',
  exists(select 1 from pg_constraint where conname='tp_players_room_seat_unique') union all
select 'constraints', 'tp_profiles_chips_chk',
  exists(select 1 from pg_constraint where conname='tp_profiles_chips_chk') union all
select 'constraints', 'tp_app_settings_singleton_chk',
  exists(select 1 from pg_constraint where conname='tp_app_settings_singleton_chk') union all
select 'constraints', 'tp_players FK -> tp_rooms',
  exists(select 1 from pg_constraint con
         join pg_class rel  on rel.oid=con.conrelid
         join pg_namespace rn on rn.oid=rel.relnamespace
         join pg_class frel on frel.oid=con.confrelid
         where con.contype='f' and rn.nspname='public'
           and rel.relname='tp_players' and frel.relname='tp_rooms') union all
select 'constraints', 'pp_players FK -> pp_rooms',
  exists(select 1 from pg_constraint con
         join pg_class rel  on rel.oid=con.conrelid
         join pg_namespace rn on rn.oid=rel.relnamespace
         join pg_class frel on frel.oid=con.confrelid
         where con.contype='f' and rn.nspname='public'
           and rel.relname='pp_players' and frel.relname='pp_rooms');

-- =====================================================================
-- Report
-- =====================================================================
\echo ''
\echo '================ VERIFY REPORT (failures first) ================'
select category,
       check_name,
       case when ok then 'PASS' else 'FAIL' end as status
from _verify
order by ok asc, category, check_name;

\echo ''
\echo '================ SUMMARY ================'
select count(*) as total,
       count(*) filter (where ok)     as passed,
       count(*) filter (where not ok) as failed
from _verify;

-- Fail the run (non-zero exit) if anything failed.
do $$
declare
  n int;
  bad text;
begin
  select count(*) into n from _verify where not ok;
  if n > 0 then
    select string_agg(category || '/' || check_name, ', ') into bad from _verify where not ok;
    raise exception 'VERIFY FAILED: % check(s) failed -> %', n, bad;
  else
    raise notice 'VERIFY OK: all % checks passed', (select count(*) from _verify);
  end if;
end $$;
