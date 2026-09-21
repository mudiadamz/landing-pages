-- =====================================================================
-- Planning Poker schema, merged into the landing_pages project.
-- Every object is prefixed `pp_` so it coexists with the host schema and
-- with texas-poker (`tp_`), which also has rooms/players tables.
-- Ported from planning-poker/supabase/schema.sql (complete source).
-- =====================================================================

-- Rooms hold deck configuration and reveal state.
create table if not exists public.pp_rooms (
  id          text primary key,
  name        text,
  deck        jsonb       not null default '["1","2","3","5","8","13","?"]'::jsonb,
  revealed    boolean     not null default false,
  owner_id    uuid,
  created_at  timestamptz not null default now()
);

alter table public.pp_rooms add column if not exists owner_id uuid;

-- Players belong to a room. `vote` is null until they pick a card.
create table if not exists public.pp_players (
  id         uuid        primary key default gen_random_uuid(),
  room_id    text        not null references public.pp_rooms(id) on delete cascade,
  name       text        not null,
  vote       text,
  last_seen  timestamptz not null default now(),
  joined_at  timestamptz not null default now()
);

create index if not exists pp_players_room_id_idx on public.pp_players (room_id);
create index if not exists pp_players_last_seen_idx on public.pp_players (last_seen);

-- Voting history: one row per completed voting round (snapshot at reset).
create table if not exists public.pp_voting_rounds (
  id           uuid        primary key default gen_random_uuid(),
  room_id      text        not null references public.pp_rooms(id) on delete cascade,
  room_name    text,
  deck         jsonb       not null,
  votes        jsonb       not null default '[]'::jsonb,
  vote_count   integer     not null default 0,
  average      numeric,
  created_at   timestamptz not null default now()
);

create index if not exists pp_voting_rounds_room_id_idx     on public.pp_voting_rounds (room_id);
create index if not exists pp_voting_rounds_created_at_idx  on public.pp_voting_rounds (created_at desc);

-- =====================================================================
-- Realtime. REPLICA IDENTITY FULL so DELETE events carry the old row.
-- =====================================================================
alter table public.pp_rooms   replica identity full;
alter table public.pp_players replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pp_rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.pp_rooms';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pp_players'
  ) then
    execute 'alter publication supabase_realtime add table public.pp_players';
  end if;
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.pp_rooms   enable row level security;
alter table public.pp_players enable row level security;

drop policy if exists "pp_rooms_select_all"  on public.pp_rooms;
drop policy if exists "pp_rooms_insert_all"  on public.pp_rooms;
drop policy if exists "pp_players_anon_all"  on public.pp_players;

create policy "pp_rooms_select_all"
  on public.pp_rooms
  for select
  to anon, authenticated
  using (true);

create policy "pp_rooms_insert_all"
  on public.pp_rooms
  for insert
  to anon, authenticated
  with check (true);

-- NOTE: no UPDATE/DELETE policy on pp_rooms on purpose. All room mutations
-- go through the SECURITY DEFINER functions below.

create policy "pp_players_anon_all"
  on public.pp_players
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- =====================================================================
-- Owner-enforced RPCs (all prefixed pp_)
-- =====================================================================

create or replace function public.pp_current_room_owner(p_room_id text)
returns uuid
language sql
stable
as $$
  select coalesce(
    (
      select r.owner_id
      from public.pp_rooms r
      join public.pp_players p
        on p.room_id = r.id and p.id = r.owner_id
      where r.id = p_room_id
    ),
    (
      select id from public.pp_players
      where room_id = p_room_id
      order by joined_at asc
      limit 1
    )
  );
$$;

create or replace function public.pp_is_room_owner(
  p_room_id   text,
  p_player_id uuid
)
returns boolean
language sql
stable
as $$
  select public.pp_current_room_owner(p_room_id) = p_player_id;
$$;

create or replace function public.pp_reveal_room(
  p_room_id   text,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pp_is_room_owner(p_room_id, p_player_id) then
    raise exception 'Only the room owner can reveal cards'
      using errcode = '42501';
  end if;
  update public.pp_rooms set revealed = true where id = p_room_id;
end;
$$;

create or replace function public.pp_reset_room(
  p_room_id   text,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room        public.pp_rooms%rowtype;
  v_votes       jsonb;
  v_vote_count  integer;
  v_average     numeric;
begin
  if not public.pp_is_room_owner(p_room_id, p_player_id) then
    raise exception 'Only the room owner can reset votes'
      using errcode = '42501';
  end if;

  select * into v_room from public.pp_rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.revealed then
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'player_id', p.id,
        'name',      p.name,
        'vote',      p.vote
      ) order by p.joined_at), '[]'::jsonb),
      count(*) filter (where p.vote is not null),
      avg(
        case
          when p.vote ~ '^-?[0-9]+(\.[0-9]+)?$' then p.vote::numeric
          when p.vote ~ '^[0-9]+/[1-9][0-9]*$' then
            split_part(p.vote, '/', 1)::numeric / split_part(p.vote, '/', 2)::numeric
          else null
        end
      )
    into v_votes, v_vote_count, v_average
    from public.pp_players p
    where p.room_id = p_room_id;

    if v_vote_count > 0 then
      insert into public.pp_voting_rounds
        (room_id, room_name, deck, votes, vote_count, average)
      values
        (p_room_id, v_room.name, v_room.deck, v_votes, v_vote_count, v_average);
    end if;
  end if;

  update public.pp_players set vote = null    where room_id = p_room_id;
  update public.pp_rooms   set revealed = false where id     = p_room_id;
end;
$$;

create or replace function public.pp_kick_player(
  p_room_id   text,
  p_owner_id  uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pp_is_room_owner(p_room_id, p_owner_id) then
    raise exception 'Only the room owner can kick players'
      using errcode = '42501';
  end if;
  if p_owner_id = p_target_id then
    raise exception 'Owner cannot kick themselves';
  end if;
  delete from public.pp_players
   where id = p_target_id and room_id = p_room_id;
end;
$$;

create or replace function public.pp_transfer_room_ownership(
  p_room_id      text,
  p_owner_id     uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pp_is_room_owner(p_room_id, p_owner_id) then
    raise exception 'Only the room owner can transfer ownership'
      using errcode = '42501';
  end if;
  if p_new_owner_id is null then
    raise exception 'New owner id is required';
  end if;
  if p_owner_id = p_new_owner_id then
    update public.pp_rooms set owner_id = p_new_owner_id where id = p_room_id;
    return;
  end if;
  if not exists (
    select 1 from public.pp_players
     where id = p_new_owner_id and room_id = p_room_id
  ) then
    raise exception 'Target player is not in this room';
  end if;
  update public.pp_rooms set owner_id = p_new_owner_id where id = p_room_id;
end;
$$;

create or replace function public.pp_update_room_deck(
  p_room_id   text,
  p_player_id uuid,
  p_deck      jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pp_is_room_owner(p_room_id, p_player_id) then
    raise exception 'Only the room owner can change the deck'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_deck) <> 'array' or jsonb_array_length(p_deck) = 0 then
    raise exception 'Deck must be a non-empty JSON array';
  end if;
  update public.pp_rooms
     set deck = p_deck, revealed = false
   where id  = p_room_id;
  update public.pp_players set vote = null where room_id = p_room_id;
end;
$$;

revoke all on function public.pp_reveal_room(text, uuid)                 from public;
revoke all on function public.pp_reset_room(text, uuid)                  from public;
revoke all on function public.pp_update_room_deck(text, uuid, jsonb)     from public;
revoke all on function public.pp_kick_player(text, uuid, uuid)           from public;
revoke all on function public.pp_transfer_room_ownership(text, uuid, uuid) from public;

grant execute on function public.pp_reveal_room(text, uuid)                to anon, authenticated;
grant execute on function public.pp_reset_room(text, uuid)                 to anon, authenticated;
grant execute on function public.pp_update_room_deck(text, uuid, jsonb)    to anon, authenticated;
grant execute on function public.pp_kick_player(text, uuid, uuid)          to anon, authenticated;
grant execute on function public.pp_transfer_room_ownership(text, uuid, uuid) to anon, authenticated;

-- =====================================================================
-- pp_voting_rounds: locked down. Only service_role can read (bypasses RLS).
-- Rows are written by pp_reset_room() (SECURITY DEFINER).
-- =====================================================================
alter table public.pp_voting_rounds enable row level security;
-- Intentionally NO policies for anon/authenticated.
