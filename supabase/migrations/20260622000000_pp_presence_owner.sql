-- =====================================================================
-- planning-poker presence + ownership hardening.
--
-- Fixes the production "room owner changes on refresh" / rejoin-churn bugs.
-- Two additions, both NEW objects (so `supabase db push` can apply them):
--   1. pp_players.left_at — an explicit "this tab is closing" marker. The
--      soft-leave beacon now sets left_at instead of backdating last_seen,
--      so a reloading player's row no longer looks ancient to the ghost
--      sweep and is never deleted mid-reload.
--   2. An AFTER DELETE trigger that reassigns pp_rooms.owner_id to the next
--      earliest-joined player when the current owner's row is actually
--      removed. Because reloads no longer delete the owner row, this fires
--      only on a genuine departure → ownership transfers permanently (a
--      returning ex-owner does not reclaim).
-- =====================================================================

alter table public.pp_players add column if not exists left_at timestamptz;

create or replace function public.pp_reassign_owner_on_leave()
returns trigger
language plpgsql
security definer            -- update pp_rooms even when fired by an anon delete
set search_path = public
as $$
begin
  -- Only act when the player who just left was the room's explicit owner.
  if exists (
    select 1 from public.pp_rooms
    where id = old.room_id and owner_id = old.id
  ) then
    update public.pp_rooms
       set owner_id = (
         select id from public.pp_players
         where room_id = old.room_id
         order by joined_at asc
         limit 1                       -- next earliest-joined, NULL if room now empty
       )
     where id = old.room_id;
  end if;
  return old;
end;
$$;

drop trigger if exists pp_players_reassign_owner on public.pp_players;
create trigger pp_players_reassign_owner
  after delete on public.pp_players
  for each row
  execute function public.pp_reassign_owner_on_leave();
