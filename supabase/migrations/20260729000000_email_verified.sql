-- Split "may sign in" from "has proven they own this address".
--
-- Email signup used to require confirmation before the first login, which meant
-- a new customer bounced to their inbox mid-purchase — and Supabase's built-in
-- mailer is capped at 2 messages an hour for the whole project, so at any real
-- signup rate most of those confirmations were never even sent. 7 of the 11
-- email accounts on this project are stuck unconfirmed and cannot log in at all.
--
-- So auth.users.email_confirmed_at stops meaning "verified" and comes to mean
-- only "allowed to sign in"; whether someone actually proved the address now
-- lives here, and is driven by our own Resend email (lib/email-verify.ts).
alter table lp_profiles
  add column if not exists email_verified_at timestamptz;

-- Carry over today's answer BEFORE the auth backfill below rewrites it.
-- Anyone confirmed by the old flow stays verified; the stuck ones stay unverified.
update lp_profiles p
set email_verified_at = u.email_confirmed_at
from auth.users u
where u.id = p.id
  and p.email_verified_at is null
  and u.email_confirmed_at is not null;

-- New accounts. Google has already proven the address it hands us, so those are
-- verified on arrival; an email signup has proven nothing yet. Read from the
-- provider rather than email_confirmed_at, because with autoconfirm on GoTrue
-- stamps that at insert for everyone and it can no longer tell them apart.
create or replace function public.lp_handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
begin
  insert into public.lp_profiles (id, full_name, email, role, email_verified_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'customer',
    case
      when coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email' then null
      else now()
    end
  );
  return new;
end;
$function$;

-- Let the accounts stranded by the old flow in. They keep email_verified_at null
-- above, so they land on the same "please verify" banner as anyone else — this
-- unblocks the login, it does not vouch for the address.
--
-- auth.users is owned by supabase_auth_admin; if this role can't write it, the
-- migration must still succeed (same pattern as the lp_rename trigger rename).
do $$
begin
  update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
exception when insufficient_privilege then
  raise notice 'email_verified: could not backfill auth.users.email_confirmed_at; existing unconfirmed accounts stay locked out until confirmed another way';
end $$;

-- Admin list filters on it (/panel/users), and it is read on every panel load.
create index if not exists lp_profiles_email_verified_at_idx
  on lp_profiles (email_verified_at);
