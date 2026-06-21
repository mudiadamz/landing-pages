-- =====================================================================
-- Texas Hold'em schema, merged into the landing_pages project.
-- Every object is prefixed `tp_` so it coexists with the host (lp_) and
-- planning-poker (pp_) schemas, which also have rooms/players/profiles.
--
-- RECONSTRUCTED FROM CODE: the texas-poker production DB was permanently
-- lost and its repo SQL (schema.sql + betting.sql) was incomplete. This
-- migration consolidates both files into clean CREATE TABLEs and restores
-- the objects that existed only in the live DB, recovered from the app:
--   * tp_app_settings table + singleton row (app/api/admin/app-settings,
--     lib/useBuyInBb, lib/types APP_SETTING_LIMITS)
--   * tp_players.last_action / last_action_amount (used throughout
--     betting.sql; lib/types Player)
--   * tp_profiles.current_session_id + tp_claim_session() (lib/useSession)
--   * tp_rooms_blinds_ratio_chk (app/api/admin/create-room comment)
-- No data migration: all tp_ tables start empty.
-- =====================================================================

-- =====================================================================
-- Tables
-- =====================================================================
create table if not exists public.tp_rooms (
  id                      text primary key,
  name                    text,
  phase                   text        not null default 'waiting'
                            constraint tp_rooms_phase_chk
                            check (phase in ('waiting','preflop','flop','turn','river','showdown')),
  community_cards         jsonb       not null default '[]'::jsonb,
  deck_remaining          jsonb       not null default '[]'::jsonb,
  phase_ends_at           timestamptz,
  pot                     bigint      not null default 0,
  current_bet             bigint      not null default 0,
  last_raise              bigint      not null default 0,
  action_player_id        uuid,
  dealer_player_id        uuid,
  small_blind             bigint      not null default 10,
  big_blind               bigint      not null default 20,
  acts_remaining          int         not null default 0,
  winners                 jsonb,
  action_timeout_seconds  int         not null default 45,
  between_hand_seconds    int         not null default 5,
  showdown_seconds        int         not null default 20,
  reveal_seconds          int         not null default 3,
  created_at              timestamptz not null default now(),
  constraint tp_rooms_action_timeout_chk check (action_timeout_seconds between 5 and 300),
  constraint tp_rooms_between_hand_chk    check (between_hand_seconds between 0 and 60),
  constraint tp_rooms_showdown_chk        check (showdown_seconds between 3 and 120),
  constraint tp_rooms_reveal_chk          check (reveal_seconds between 0 and 30),
  constraint tp_rooms_blinds_ratio_chk    check (big_blind = small_blind * 2)
);

create table if not exists public.tp_players (
  id                  uuid        primary key default gen_random_uuid(),
  room_id             text        not null references public.tp_rooms(id) on delete cascade,
  name                text        not null,
  hole_cards          jsonb,
  chips               bigint      not null default 1000,
  bet_street          bigint      not null default 0,
  folded              boolean     not null default false,
  all_in              boolean     not null default false,
  -- Static slot 1..9 around the table; assigned by trigger on insert.
  seat_number         int         not null,
  -- Last action on the current street: fold|check|call|raise|all_in|null.
  last_action         text,
  -- Chips committed (call/all_in) or new total (raise); 0 for check/fold.
  last_action_amount  bigint      not null default 0,
  avatar_url          text,
  user_id             uuid        references auth.users(id) on delete set null,
  last_seen           timestamptz not null default now(),
  joined_at           timestamptz not null default now(),
  constraint tp_players_seat_number_chk  check (seat_number between 1 and 9),
  constraint tp_players_room_seat_unique unique (room_id, seat_number)
);

create index if not exists tp_players_user_id_idx   on public.tp_players (user_id);
create index if not exists tp_players_room_id_idx    on public.tp_players (room_id);
create index if not exists tp_players_last_seen_idx  on public.tp_players (last_seen);

-- Per-user persistent bankroll.
create table if not exists public.tp_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  chips                bigint not null default 0,
  is_admin             boolean not null default false,
  spins_remaining      int  not null default 3,
  next_spin_refill_at  timestamptz,
  welcome_claimed_at   timestamptz,
  last_spin_at         timestamptz,
  last_daily_at        timestamptz,
  -- Single-session guard: the device id that currently owns this account
  -- (lib/useSession). A mismatch signs the older device out.
  current_session_id   text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint tp_profiles_chips_chk check (chips >= 0)
);

-- Global, admin-tunable game config (single row, id = 1).
create table if not exists public.tp_app_settings (
  id                      int  primary key,
  action_timeout_seconds  int  not null default 45,
  between_hand_seconds     int  not null default 5,
  showdown_seconds         int  not null default 20,
  reveal_seconds           int  not null default 3,
  buy_in_bb                int  not null default 100,
  constraint tp_app_settings_singleton_chk      check (id = 1),
  constraint tp_app_settings_action_timeout_chk check (action_timeout_seconds between 5 and 300),
  constraint tp_app_settings_between_hand_chk    check (between_hand_seconds between 0 and 60),
  constraint tp_app_settings_showdown_chk        check (showdown_seconds between 3 and 120),
  constraint tp_app_settings_reveal_chk          check (reveal_seconds between 0 and 30),
  constraint tp_app_settings_buy_in_bb_chk       check (buy_in_bb between 1 and 1000)
);

insert into public.tp_app_settings
  (id, action_timeout_seconds, between_hand_seconds, showdown_seconds, reveal_seconds, buy_in_bb)
values
  (1, 45, 5, 20, 3, 100)
on conflict (id) do nothing;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.tp_rooms        enable row level security;
alter table public.tp_players      enable row level security;
alter table public.tp_profiles     enable row level security;
alter table public.tp_app_settings enable row level security;

drop policy if exists "tp_rooms_select_all"      on public.tp_rooms;
drop policy if exists "tp_rooms_insert_all"      on public.tp_rooms;
drop policy if exists "tp_players_anon_all"      on public.tp_players;
drop policy if exists "tp_profiles_self_read"    on public.tp_profiles;
drop policy if exists "tp_app_settings_read_all" on public.tp_app_settings;

create policy "tp_rooms_select_all"
  on public.tp_rooms for select to anon, authenticated using (true);
create policy "tp_rooms_insert_all"
  on public.tp_rooms for insert to anon, authenticated with check (true);

create policy "tp_players_anon_all"
  on public.tp_players for all to anon, authenticated using (true) with check (true);

-- Profiles: readable only by their owner. All writes go through
-- SECURITY DEFINER functions (bonuses, buy-ins, session claim).
create policy "tp_profiles_self_read"
  on public.tp_profiles for select to authenticated using (user_id = auth.uid());

-- App settings: world-readable; only service_role (admin route) writes.
create policy "tp_app_settings_read_all"
  on public.tp_app_settings for select to anon, authenticated using (true);

-- =====================================================================
-- Realtime: REPLICA IDENTITY FULL so DELETE/UPDATE payloads carry the
-- full row (room_id on deletes, current_session_id on profile updates).
-- =====================================================================
alter table public.tp_rooms        replica identity full;
alter table public.tp_players      replica identity full;
alter table public.tp_profiles     replica identity full;
alter table public.tp_app_settings replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tp_rooms') then
    execute 'alter publication supabase_realtime add table public.tp_rooms';
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tp_players') then
    execute 'alter publication supabase_realtime add table public.tp_players';
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tp_profiles') then
    execute 'alter publication supabase_realtime add table public.tp_profiles';
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tp_app_settings') then
    execute 'alter publication supabase_realtime add table public.tp_app_settings';
  end if;
end $$;

-- =====================================================================
-- Profiles: updated_at touch + auto-create on signup
-- =====================================================================
create or replace function public.tp_profiles_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create or replace function public.tp_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tp_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Single-session guard: claim this account for the calling device.
-- SECURITY DEFINER so it can write the caller's own profile row (the
-- self-read RLS policy has no UPDATE clause).
create or replace function public.tp_claim_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  update public.tp_profiles
     set current_session_id = p_session_id
   where user_id = v_uid;
end;
$$;

-- =====================================================================
-- Welcome bonus + hourly spin wheel + daily bonus
-- =====================================================================
create or replace function public.tp_claim_welcome_bonus()
returns table(amount int, total_chips int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_amount int := 10000000;
  v_claimed timestamptz;
  v_total int;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select welcome_claimed_at into v_claimed
    from public.tp_profiles
   where user_id = v_uid
   for update;

  if v_claimed is not null then
    raise exception 'welcome bonus already claimed' using errcode = 'P0001';
  end if;

  update public.tp_profiles
     set chips = chips + v_amount,
         welcome_claimed_at = now()
   where user_id = v_uid
  returning chips into v_total;

  return query select v_amount, v_total;
end;
$$;

create or replace function public.tp_spin_wheel()
returns table(
  prize int,
  segment_index int,
  total_chips int,
  spins_remaining int,
  next_refill_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_cooldown interval := interval '1 hour';
  v_remaining int;
  v_refill_at timestamptz;
  v_prizes int[]  := array[50000, 100000, 250000, 500000, 1000000, 2000000, 5000000, 10000000];
  v_weights int[] := array[35, 25, 15, 10, 8, 5, 1, 1];
  v_total_w int := 100;
  v_roll int;
  v_acc int := 0;
  v_loop_i int;
  v_picked int;
  v_prize int;
  v_total int;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select p.spins_remaining, p.next_spin_refill_at
    into v_remaining, v_refill_at
    from public.tp_profiles p
   where p.user_id = v_uid
   for update;

  if v_refill_at is not null and v_now >= v_refill_at then
    v_remaining := 3;
    v_refill_at := null;
  end if;

  if coalesce(v_remaining, 0) <= 0 then
    raise exception 'spin cooldown active' using errcode = 'P0001';
  end if;

  v_roll := floor(random() * v_total_w)::int + 1;
  for v_loop_i in 1..array_length(v_weights, 1) loop
    v_acc := v_acc + v_weights[v_loop_i];
    if v_roll <= v_acc then
      v_prize := v_prizes[v_loop_i];
      v_picked := v_loop_i;
      exit;
    end if;
  end loop;

  v_remaining := v_remaining - 1;
  if v_remaining <= 0 then
    v_refill_at := v_now + v_cooldown;
  end if;

  update public.tp_profiles as p
     set chips               = p.chips + v_prize,
         spins_remaining     = v_remaining,
         next_spin_refill_at = v_refill_at,
         last_spin_at        = v_now
   where p.user_id = v_uid
  returning p.chips into v_total;

  return query select v_prize, v_picked - 1, v_total, v_remaining, v_refill_at;
end;
$$;

create or replace function public.tp_claim_daily_bonus()
returns table(prize int, total_chips int, next_claim_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_cooldown interval := interval '24 hours';
  v_amount int := 1000000;
  v_last timestamptz;
  v_total int;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select last_daily_at into v_last
    from public.tp_profiles
   where user_id = v_uid
   for update;

  if v_last is not null and v_last + v_cooldown > v_now then
    raise exception 'daily bonus on cooldown' using errcode = 'P0001';
  end if;

  update public.tp_profiles
     set chips = chips + v_amount,
         last_daily_at = v_now
   where user_id = v_uid
  returning chips into v_total;

  return query select v_amount, v_total, v_now + v_cooldown;
end;
$$;

-- =====================================================================
-- Seat assignment + buy-in deduction + join grace timer
-- =====================================================================
create or replace function public.tp_assign_seat_number()
returns trigger
language plpgsql
as $$
declare
  v_taken int[];
  v_available int[];
  v_total int;
begin
  if new.seat_number is not null then
    return new;
  end if;

  select coalesce(array_agg(seat_number), array[]::int[])
    into v_taken
    from public.tp_players
   where room_id = new.room_id;

  select coalesce(array_agg(s), array[]::int[])
    into v_available
    from generate_series(1, 9) as s
   where not (s = any(v_taken));

  v_total := coalesce(array_length(v_available, 1), 0);
  if v_total = 0 then
    raise exception 'Room is full (9 players maximum)' using errcode = 'P0001';
  end if;

  new.seat_number := v_available[1 + floor(random() * v_total)::int];
  return new;
end;
$$;

create or replace function public.tp_player_default_chips()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bb bigint;
  v_mult int;
  v_min_buyin bigint;
  v_max_buyin bigint;
  v_buyin bigint;
  v_balance bigint;
begin
  select big_blind into v_bb from public.tp_rooms where id = new.room_id;
  select buy_in_bb into v_mult from public.tp_app_settings where id = 1;
  v_min_buyin := coalesce(v_bb, 20) * 20;          -- MIN_BUY_IN_BB
  v_max_buyin := coalesce(v_bb, 20) * coalesce(v_mult, 100);

  if new.user_id is not null then
    select chips into v_balance
      from public.tp_profiles
     where user_id = new.user_id
     for update;

    if coalesce(v_balance, 0) < v_min_buyin then
      raise exception 'Not enough main chips. Minimum buy-in is %, you have %.',
        v_min_buyin, coalesce(v_balance, 0)
        using errcode = 'P0001';
    end if;

    v_buyin := case when v_balance >= v_max_buyin then v_max_buyin
                    else v_min_buyin end;
    new.chips := v_buyin;

    update public.tp_profiles
       set chips = chips - v_buyin
     where user_id = new.user_id;
  else
    new.chips := v_max_buyin;
  end if;

  return new;
end;
$$;

create or replace function public.tp_player_join_waiting_timer()
returns trigger
language plpgsql
as $$
declare
  v_phase text;
  v_delay int;
  v_active int;
  v_now timestamptz := now();
begin
  if coalesce(new.chips, 0) <= 0 then return new; end if;

  select phase into v_phase from public.tp_rooms where id = new.room_id;
  if v_phase is distinct from 'waiting' then return new; end if;

  select between_hand_seconds into v_delay from public.tp_timing_settings();
  v_delay := greatest(coalesce(v_delay, 5), 3);

  select count(*)::int into v_active
    from public.tp_players
   where room_id = new.room_id and chips > 0;
  if v_active < 2 then return new; end if;

  update public.tp_rooms
     set phase_ends_at = greatest(
       coalesce(phase_ends_at, v_now),
       v_now + make_interval(secs => v_delay)
     )
   where id = new.room_id;
  return new;
end;
$$;

-- =====================================================================
-- Deck + seat/order helpers
-- =====================================================================
create or replace function public.tp_new_shuffled_deck()
returns jsonb
language plpgsql
as $$
declare
  ranks text[] := array['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  suits text[] := array['S','H','D','C'];
  deck jsonb := '[]'::jsonb;
  r text;
  s text;
  i int;
  j int;
  tmp jsonb;
  n int;
begin
  foreach r in array ranks loop
    foreach s in array suits loop
      deck := deck || jsonb_build_array(r || s);
    end loop;
  end loop;

  n := jsonb_array_length(deck);
  for i in reverse n-1..1 loop
    j := floor(random() * (i + 1))::int;
    tmp := deck->i;
    deck := jsonb_set(deck, array[i::text], deck->j);
    deck := jsonb_set(deck, array[j::text], tmp);
  end loop;

  return deck;
end;
$$;

create or replace function public.tp_room_seat_ids(p_room_id text)
returns uuid[]
language sql
stable
as $$
  select coalesce(array_agg(id order by seat_number), array[]::uuid[])
  from public.tp_players
  where room_id = p_room_id;
$$;

create or replace function public.tp_seat_index(p_seats uuid[], p_player_id uuid)
returns int
language sql
immutable
as $$
  select coalesce(
    (select ord::int - 1
     from unnest(p_seats) with ordinality as t(id, ord)
     where id = p_player_id),
    -1
  );
$$;

create or replace function public.tp_next_seat_player(
  p_seats uuid[],
  p_from_id uuid,
  p_skip_folded boolean default true
)
returns uuid
language plpgsql
stable
as $$
declare
  v_idx int;
  v_n int;
  v_i int;
  v_id uuid;
  v_folded boolean;
begin
  v_n := coalesce(array_length(p_seats, 1), 0);
  if v_n = 0 then return null; end if;
  v_idx := public.tp_seat_index(p_seats, p_from_id);
  if v_idx < 0 then return p_seats[1]; end if;

  for v_i in 1..v_n loop
    v_idx := (v_idx + 1) % v_n;
    v_id := p_seats[v_idx + 1];
    if not p_skip_folded then return v_id; end if;
    select folded into v_folded from public.tp_players where id = v_id;
    if not coalesce(v_folded, false) then return v_id; end if;
  end loop;
  return null;
end;
$$;

create or replace function public.tp_count_not_folded(p_room_id text)
returns int
language sql
stable
as $$
  select count(*)::int from public.tp_players
  where room_id = p_room_id
    and not folded
    and jsonb_array_length(coalesce(hole_cards, '[]'::jsonb)) = 2;
$$;

create or replace function public.tp_count_can_act(p_room_id text)
returns int
language sql
stable
as $$
  select count(*)::int from public.tp_players
  where room_id = p_room_id
    and not folded
    and not all_in
    and chips > 0
    and jsonb_array_length(coalesce(hole_cards, '[]'::jsonb)) = 2;
$$;

-- =====================================================================
-- Pot / commit helpers
-- =====================================================================
create or replace function public.tp_player_commit(
  p_player_id uuid,
  p_amount bigint
)
returns bigint
language plpgsql
as $$
declare
  v_chips bigint;
  v_pay bigint;
  v_room_id text;
begin
  select chips, room_id into v_chips, v_room_id
  from public.tp_players where id = p_player_id for update;
  v_pay := least(greatest(p_amount, 0), v_chips);
  update public.tp_players
     set chips = chips - v_pay,
         bet_street = bet_street + v_pay,
         all_in = (v_chips - v_pay <= 0)
   where id = p_player_id;
  update public.tp_rooms set pot = pot + v_pay where id = v_room_id;
  return v_pay;
end;
$$;

create or replace function public.tp_award_pot_to(p_room_id text, p_winner_id uuid)
returns void
language plpgsql
as $$
declare
  v_pot bigint;
begin
  select pot into v_pot from public.tp_rooms where id = p_room_id for update;
  update public.tp_players set chips = chips + v_pot where id = p_winner_id;
  update public.tp_rooms set pot = 0 where id = p_room_id;
end;
$$;

-- =====================================================================
-- Timing source of truth (reads tp_app_settings)
-- =====================================================================
create or replace function public.tp_timing_settings()
returns table(
  action_timeout_seconds int,
  between_hand_seconds int,
  showdown_seconds int,
  reveal_seconds int
)
language sql
stable
as $$
  select
    coalesce(action_timeout_seconds, 45)::int,
    coalesce(between_hand_seconds, 5)::int,
    coalesce(showdown_seconds, 20)::int,
    coalesce(reveal_seconds, 3)::int
  from public.tp_app_settings
  where id = 1;
$$;

create or replace function public.tp_reset_hand_state(p_room_id text)
returns void
language plpgsql
as $$
declare
  v_between int;
begin
  select between_hand_seconds into v_between from public.tp_timing_settings();
  v_between := coalesce(v_between, 5);

  update public.tp_players
     set hole_cards = null,
         bet_street = 0,
         folded = false,
         all_in = false,
         last_action = null,
         last_action_amount = 0
   where room_id = p_room_id;
  update public.tp_rooms
     set phase = 'waiting',
         community_cards = '[]'::jsonb,
         deck_remaining = '[]'::jsonb,
         pot = 0,
         current_bet = 0,
         last_raise = 0,
         action_player_id = null,
         acts_remaining = 0,
         winners = null,
         phase_ends_at = now() + make_interval(secs => v_between)
   where id = p_room_id;
end;
$$;

create or replace function public.tp_deal_community(
  p_room record,
  p_count int
)
returns jsonb
language plpgsql
as $$
declare
  v_deck jsonb;
begin
  v_deck := coalesce(p_room.deck_remaining, '[]'::jsonb);
  if jsonb_array_length(v_deck) < p_count + 1 then
    raise exception 'Not enough cards in deck';
  end if;
  return (
    select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
    from jsonb_array_elements(v_deck) with ordinality as t(elem, ord)
    where ord > p_count
  );
end;
$$;

create or replace function public.tp_next_action_player(
  p_room_id text,
  p_start uuid
)
returns uuid
language plpgsql
stable
as $$
declare
  v_seats uuid[];
  v_cur uuid;
  v_i int;
  v_n int;
  v_p public.tp_players%rowtype;
begin
  v_seats := public.tp_room_seat_ids(p_room_id);
  v_n := coalesce(array_length(v_seats, 1), 0);
  if v_n = 0 then return null; end if;
  v_cur := p_start;
  if v_cur is null then v_cur := v_seats[1]; end if;

  for v_i in 1..v_n loop
    select * into v_p from public.tp_players where id = v_cur;
    if not v_p.folded
       and not v_p.all_in
       and v_p.chips > 0
       and jsonb_array_length(coalesce(v_p.hole_cards, '[]'::jsonb)) = 2 then
      return v_cur;
    end if;
    v_cur := public.tp_next_seat_player(v_seats, v_cur, true);
  end loop;
  return null;
end;
$$;

create or replace function public.tp_betting_round_done(p_room_id text)
returns boolean
language plpgsql
stable
as $$
declare
  v_room public.tp_rooms%rowtype;
  v_unmatched int;
begin
  select * into v_room from public.tp_rooms where id = p_room_id;
  if v_room.acts_remaining <= 0 then
    select count(*)::int into v_unmatched
    from public.tp_players
    where room_id = p_room_id
      and not folded
      and not all_in
      and chips > 0
      and jsonb_array_length(coalesce(hole_cards, '[]'::jsonb)) = 2
      and bet_street < v_room.current_bet;
    return v_unmatched = 0;
  end if;
  return false;
end;
$$;

create or replace function public.tp_complete_betting_round(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.tp_rooms%rowtype;
  v_seats uuid[];
  v_dealer uuid;
  v_first uuid;
  v_deck jsonb;
  v_not_folded int;
  v_can_act int;
  v_action_sec int;
  v_showdown_sec int;
  v_reveal_sec int;
begin
  select * into v_room from public.tp_rooms where id = p_room_id for update;
  v_seats := public.tp_room_seat_ids(p_room_id);

  select action_timeout_seconds, showdown_seconds, reveal_seconds
    into v_action_sec, v_showdown_sec, v_reveal_sec
  from public.tp_timing_settings();
  v_action_sec := coalesce(v_action_sec, 45);
  v_showdown_sec := coalesce(v_showdown_sec, 20);
  v_reveal_sec := coalesce(v_reveal_sec, 3);

  update public.tp_players
     set bet_street = 0,
         last_action = null,
         last_action_amount = 0
   where room_id = p_room_id;
  update public.tp_rooms
     set current_bet = 0,
         last_raise = 0,
         acts_remaining = 0
   where id = p_room_id;

  v_not_folded := public.tp_count_not_folded(p_room_id);
  if v_not_folded <= 1 then
    select id into v_first from public.tp_players
     where room_id = p_room_id
       and not folded
       and jsonb_array_length(coalesce(hole_cards, '[]'::jsonb)) = 2
     limit 1;
    if v_first is not null then
      perform public.tp_award_pot_to(p_room_id, v_first);
    end if;
    perform public.tp_reset_hand_state(p_room_id);
    return;
  end if;

  v_dealer := v_room.dealer_player_id;

  -- Re-fetch room because we just mutated it above.
  select * into v_room from public.tp_rooms where id = p_room_id for update;

  if v_room.phase = 'preflop' then
    v_deck := coalesce(v_room.deck_remaining, '[]'::jsonb);
    update public.tp_rooms
       set phase = 'flop',
           community_cards = jsonb_build_array(v_deck->1, v_deck->2, v_deck->3),
           deck_remaining = public.tp_deal_community(v_room, 3)
     where id = p_room_id;
  elsif v_room.phase = 'flop' then
    v_deck := coalesce(v_room.deck_remaining, '[]'::jsonb);
    update public.tp_rooms
       set phase = 'turn',
           community_cards = v_room.community_cards || jsonb_build_array(v_deck->1),
           deck_remaining = public.tp_deal_community(v_room, 1)
     where id = p_room_id;
  elsif v_room.phase = 'turn' then
    v_deck := coalesce(v_room.deck_remaining, '[]'::jsonb);
    update public.tp_rooms
       set phase = 'river',
           community_cards = v_room.community_cards || jsonb_build_array(v_deck->1),
           deck_remaining = public.tp_deal_community(v_room, 1)
     where id = p_room_id;
  elsif v_room.phase = 'river' then
    update public.tp_rooms
       set phase = 'showdown',
           action_player_id = null,
           phase_ends_at = now() + make_interval(secs => v_showdown_sec)
     where id = p_room_id;
    return;
  end if;

  v_can_act := public.tp_count_can_act(p_room_id);

  if v_can_act <= 1 then
    update public.tp_rooms
       set action_player_id = null,
           acts_remaining = 0,
           phase_ends_at = now() + make_interval(secs => v_reveal_sec)
     where id = p_room_id;
    return;
  end if;

  select * into v_room from public.tp_rooms where id = p_room_id;
  v_first := public.tp_next_seat_player(v_seats, v_dealer, true);
  v_first := public.tp_next_action_player(p_room_id, v_first);

  update public.tp_rooms
     set action_player_id = v_first,
         acts_remaining = v_can_act,
         phase_ends_at = now() + make_interval(secs => v_action_sec)
   where id = p_room_id;
end;
$$;

create or replace function public.tp_advance_action(p_room_id text)
returns void
language plpgsql
as $$
declare
  v_room public.tp_rooms%rowtype;
  v_next uuid;
  v_seats uuid[];
  v_action_sec int;
  v_reveal_sec int;
begin
  select * into v_room from public.tp_rooms where id = p_room_id for update;
  select action_timeout_seconds, reveal_seconds
    into v_action_sec, v_reveal_sec
  from public.tp_timing_settings();
  v_action_sec := coalesce(v_action_sec, 45);
  v_reveal_sec := coalesce(v_reveal_sec, 3);

  if public.tp_count_not_folded(p_room_id) <= 1 then
    update public.tp_rooms
       set action_player_id = null,
           acts_remaining = 0,
           phase_ends_at = now() + make_interval(secs => v_reveal_sec)
     where id = p_room_id;
    return;
  end if;

  if public.tp_betting_round_done(p_room_id) then
    update public.tp_rooms
       set action_player_id = null,
           acts_remaining = 0,
           phase_ends_at = now() + make_interval(secs => v_reveal_sec)
     where id = p_room_id;
    return;
  end if;

  v_seats := public.tp_room_seat_ids(p_room_id);
  v_next := public.tp_next_seat_player(v_seats, v_room.action_player_id, true);
  v_next := public.tp_next_action_player(p_room_id, v_next);

  update public.tp_rooms
     set action_player_id = v_next,
         phase_ends_at = now() + make_interval(secs => v_action_sec)
   where id = p_room_id;
end;
$$;

-- =====================================================================
-- player_action
-- =====================================================================
create or replace function public.tp_player_action(
  p_room_id text,
  p_player_id uuid,
  p_action text,
  p_raise_to bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.tp_rooms%rowtype;
  v_player public.tp_players%rowtype;
  v_pay bigint;
  v_to_call bigint;
  v_min_raise bigint;
  v_raise_total bigint;
  v_others_can_act int;
begin
  select * into v_room from public.tp_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.phase in ('waiting', 'showdown') then
    raise exception 'No betting in this phase';
  end if;
  if v_room.action_player_id is distinct from p_player_id then
    raise exception 'Not your turn';
  end if;

  select * into v_player from public.tp_players where id = p_player_id for update;
  if v_player.folded or v_player.all_in then
    raise exception 'Cannot act';
  end if;

  v_to_call := v_room.current_bet - v_player.bet_street;

  if p_action = 'fold' then
    update public.tp_players
       set folded = true,
           last_action = 'fold',
           last_action_amount = 0
     where id = p_player_id;
    update public.tp_rooms set acts_remaining = greatest(acts_remaining - 1, 0)
     where id = p_room_id;
    perform public.tp_advance_action(p_room_id);
    return;
  end if;

  if p_action = 'check' then
    if v_to_call > 0 then raise exception 'Cannot check, must call or fold'; end if;
    update public.tp_players
       set last_action = 'check',
           last_action_amount = 0
     where id = p_player_id;
    update public.tp_rooms set acts_remaining = greatest(acts_remaining - 1, 0)
     where id = p_room_id;
    perform public.tp_advance_action(p_room_id);
    return;
  end if;

  if p_action = 'call' then
    if v_to_call <= 0 then raise exception 'Nothing to call'; end if;
    v_pay := public.tp_player_commit(p_player_id, v_to_call);
    update public.tp_players
       set last_action = 'call',
           last_action_amount = v_pay
     where id = p_player_id;
    update public.tp_rooms set acts_remaining = greatest(acts_remaining - 1, 0)
     where id = p_room_id;
    perform public.tp_advance_action(p_room_id);
    return;
  end if;

  if p_action = 'all_in' then
    v_pay := public.tp_player_commit(p_player_id, v_player.chips);
    select bet_street into v_raise_total from public.tp_players where id = p_player_id;
    update public.tp_players
       set last_action = 'all_in',
           last_action_amount = v_raise_total
     where id = p_player_id;
    if v_raise_total > v_room.current_bet then
      select count(*)::int into v_others_can_act
        from public.tp_players
       where room_id = p_room_id
         and id <> p_player_id
         and not folded and not all_in and chips > 0;
      update public.tp_rooms
         set current_bet = v_raise_total,
             last_raise = v_raise_total - v_room.current_bet,
             acts_remaining = v_others_can_act
       where id = p_room_id;
    else
      update public.tp_rooms set acts_remaining = greatest(acts_remaining - 1, 0)
       where id = p_room_id;
    end if;
    perform public.tp_advance_action(p_room_id);
    return;
  end if;

  if p_action = 'raise' then
    if p_raise_to is null then raise exception 'raise_to required'; end if;
    v_min_raise := v_room.current_bet + greatest(v_room.last_raise, v_room.big_blind);
    v_raise_total := greatest(p_raise_to, v_min_raise);
    if v_raise_total <= v_room.current_bet then
      raise exception 'Raise must exceed current bet';
    end if;
    v_pay := public.tp_player_commit(p_player_id, v_raise_total - v_player.bet_street);
    select bet_street into v_raise_total from public.tp_players where id = p_player_id;
    update public.tp_players
       set last_action = 'raise',
           last_action_amount = v_raise_total
     where id = p_player_id;
    select count(*)::int into v_others_can_act
      from public.tp_players
     where room_id = p_room_id
       and id <> p_player_id
       and not folded and not all_in and chips > 0;
    update public.tp_rooms
       set current_bet = v_raise_total,
           last_raise = v_raise_total - v_room.current_bet,
           acts_remaining = v_others_can_act
     where id = p_room_id;
    perform public.tp_advance_action(p_room_id);
    return;
  end if;

  raise exception 'Unknown action: %', p_action;
end;
$$;

create or replace function public.tp_action_timeout(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.tp_rooms%rowtype;
begin
  select * into v_room from public.tp_rooms where id = p_room_id for update;
  if v_room.action_player_id is null then return; end if;
  if v_room.phase_ends_at is not null and now() < v_room.phase_ends_at then
    raise exception 'Action timer not expired';
  end if;
  perform public.tp_player_action(p_room_id, v_room.action_player_id, 'fold');
end;
$$;

-- =====================================================================
-- Auto-dealer: idempotent under row lock
-- =====================================================================
create or replace function public.tp_start_hand(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck jsonb;
  v_idx int := 0;
  v_player record;
  v_active_count int;
  v_phase text;
  v_phase_ends_at timestamptz;
  v_seats uuid[];
  v_n int;
  v_sb uuid;
  v_bb uuid;
  v_first uuid;
  v_dealer uuid;
  v_sb_amt bigint;
  v_bb_amt bigint;
  v_action_sec int;
begin
  select phase, phase_ends_at
    into v_phase, v_phase_ends_at
  from public.tp_rooms where id = p_room_id for update;

  if not found then
    raise exception 'Room not found';
  end if;
  if v_phase is distinct from 'waiting' then return; end if;
  if v_phase_ends_at is not null and now() < v_phase_ends_at then return; end if;

  select count(*) into v_active_count
    from public.tp_players where room_id = p_room_id and chips > 0;
  if v_active_count < 2 then return; end if;

  select coalesce(array_agg(id order by seat_number), array[]::uuid[])
    into v_seats
  from public.tp_players where room_id = p_room_id and chips > 0;
  v_n := array_length(v_seats, 1);

  select dealer_player_id into v_dealer from public.tp_rooms where id = p_room_id;
  if v_dealer is null or public.tp_seat_index(v_seats, v_dealer) < 0 then
    v_dealer := v_seats[1];
  else
    v_dealer := public.tp_next_seat_player(v_seats, v_dealer, false);
  end if;

  if v_n = 2 then
    v_sb := v_dealer;
    v_bb := public.tp_next_seat_player(v_seats, v_dealer, false);
    v_first := v_dealer;
  else
    v_sb := public.tp_next_seat_player(v_seats, v_dealer, false);
    v_bb := public.tp_next_seat_player(v_seats, v_sb, false);
    v_first := public.tp_next_seat_player(v_seats, v_bb, false);
  end if;

  update public.tp_players
     set bet_street = 0, folded = false, all_in = false, hole_cards = null,
         last_action = null, last_action_amount = 0
   where room_id = p_room_id;

  select small_blind, big_blind into v_sb_amt, v_bb_amt from public.tp_rooms where id = p_room_id;

  perform public.tp_player_commit(v_sb, v_sb_amt);
  perform public.tp_player_commit(v_bb, v_bb_amt);

  v_deck := public.tp_new_shuffled_deck();
  for v_player in
    select id from public.tp_players
      where room_id = p_room_id and chips > 0
      order by seat_number
  loop
    update public.tp_players
       set hole_cards = jsonb_build_array(v_deck->v_idx, v_deck->(v_idx+1))
     where id = v_player.id;
    v_idx := v_idx + 2;
  end loop;

  select action_timeout_seconds into v_action_sec from public.tp_timing_settings();
  v_action_sec := coalesce(v_action_sec, 45);

  update public.tp_rooms
     set phase = 'preflop',
         dealer_player_id = v_dealer,
         community_cards = '[]'::jsonb,
         deck_remaining = (
           select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
           from jsonb_array_elements(v_deck) with ordinality as t(elem, ord)
           where ord > v_idx
         ),
         pot = (select coalesce(sum(bet_street), 0) from public.tp_players where room_id = p_room_id),
         current_bet = v_bb_amt,
         last_raise = v_bb_amt,
         action_player_id = public.tp_next_action_player(p_room_id, v_first),
         acts_remaining = public.tp_count_can_act(p_room_id),
         winners = null,
         phase_ends_at = now() + make_interval(secs => v_action_sec)
   where id = p_room_id;
end;
$$;

create or replace function public.tp_end_showdown(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.tp_rooms%rowtype;
begin
  select * into v_room from public.tp_rooms where id = p_room_id for update;
  if v_room.phase is distinct from 'showdown' then return; end if;
  if v_room.phase_ends_at is not null and now() < v_room.phase_ends_at then
    raise exception 'Showdown not finished';
  end if;
  perform public.tp_reset_hand_state(p_room_id);
end;
$$;

create or replace function public.tp_apply_showdown_winners(
  p_room_id text,
  p_winners jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.tp_rooms%rowtype;
  v_pot bigint;
  v_count int;
  v_share bigint;
  w jsonb;
  v_pid uuid;
  v_showdown_sec int;
begin
  select * into v_room from public.tp_rooms where id = p_room_id for update;
  if v_room.phase is distinct from 'showdown' then
    raise exception 'Not in showdown';
  end if;
  if v_room.winners is not null then return; end if;

  select showdown_seconds into v_showdown_sec from public.tp_timing_settings();
  v_showdown_sec := coalesce(v_showdown_sec, 20);
  v_pot := v_room.pot;
  v_count := jsonb_array_length(p_winners);
  if v_count <= 0 then
    perform public.tp_reset_hand_state(p_room_id);
    return;
  end if;

  v_share := v_pot / v_count;
  for w in select * from jsonb_array_elements(p_winners) loop
    v_pid := (w->>'player_id')::uuid;
    update public.tp_players set chips = chips + v_share where id = v_pid;
  end loop;

  update public.tp_rooms
     set pot = 0,
         winners = p_winners,
         phase_ends_at = now() + make_interval(secs => v_showdown_sec)
   where id = p_room_id;
end;
$$;

create or replace function public.tp_advance_phase(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.tp_rooms%rowtype;
begin
  select * into v_room from public.tp_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;

  if v_room.phase = 'showdown' then
    perform public.tp_end_showdown(p_room_id);
    return;
  end if;

  if v_room.phase_ends_at is null or now() < v_room.phase_ends_at then
    return;
  end if;

  if v_room.action_player_id is not null then
    perform public.tp_action_timeout(p_room_id);
    return;
  end if;

  if v_room.phase in ('preflop', 'flop', 'turn', 'river') then
    perform public.tp_complete_betting_round(p_room_id);
  end if;
end;
$$;

-- =====================================================================
-- Triggers
-- =====================================================================
drop trigger if exists tp_profiles_touch on public.tp_profiles;
create trigger tp_profiles_touch
  before update on public.tp_profiles
  for each row execute function public.tp_profiles_touch_updated_at();

drop trigger if exists tp_on_auth_user_created on auth.users;
create trigger tp_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tp_handle_new_user();

drop trigger if exists tp_players_assign_seat on public.tp_players;
create trigger tp_players_assign_seat
  before insert on public.tp_players
  for each row execute function public.tp_assign_seat_number();

drop trigger if exists tp_players_default_chips on public.tp_players;
create trigger tp_players_default_chips
  before insert on public.tp_players
  for each row execute function public.tp_player_default_chips();

drop trigger if exists tp_players_waiting_timer on public.tp_players;
create trigger tp_players_waiting_timer
  after insert on public.tp_players
  for each row execute function public.tp_player_join_waiting_timer();

-- =====================================================================
-- Grants
-- =====================================================================
grant execute on function public.tp_claim_welcome_bonus()         to authenticated;
grant execute on function public.tp_spin_wheel()                  to authenticated;
grant execute on function public.tp_claim_daily_bonus()           to authenticated;
grant execute on function public.tp_claim_session(text)           to authenticated;

revoke all on function public.tp_start_hand(text)                       from public;
revoke all on function public.tp_player_action(text, uuid, text, bigint) from public;
revoke all on function public.tp_action_timeout(text)                   from public;
revoke all on function public.tp_end_showdown(text)                     from public;
revoke all on function public.tp_apply_showdown_winners(text, jsonb)    from public;

grant execute on function public.tp_start_hand(text)                       to anon, authenticated;
grant execute on function public.tp_player_action(text, uuid, text, bigint) to anon, authenticated;
grant execute on function public.tp_action_timeout(text)                   to anon, authenticated;
grant execute on function public.tp_end_showdown(text)                     to anon, authenticated;
grant execute on function public.tp_apply_showdown_winners(text, jsonb)    to anon, authenticated;
grant execute on function public.tp_advance_phase(text)                    to anon, authenticated;
