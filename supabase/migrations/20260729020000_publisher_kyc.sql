-- Identity check for publisher applications: a live photo of the KTP and a live
-- selfie, reviewed by an admin who can reject with a note.
alter table public.lp_profiles
  add column if not exists publisher_ktp_path    text,
  add column if not exists publisher_selfie_path text,
  -- Why it was turned down, shown back to the applicant so a re-application
  -- can fix the actual problem instead of guessing.
  add column if not exists publisher_reject_note text,
  add column if not exists publisher_reviewed_by uuid references auth.users (id) on delete set null;

-- Private bucket. These are government ID photographs: they must never be
-- reachable by URL, so nothing here is public and the admin screen reads them
-- through short-lived signed URLs minted server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publisher-kyc',
  'publisher-kyc',
  false,
  5242880,
  array['image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Deliberately NO storage policies for this bucket.
--
-- Every other bucket lets the owner write into their own folder, because the
-- browser uploads straight to storage. Not here: the photos are posted to a
-- server action and written with the service role, so no signed-in user — not
-- even the applicant — can read, list, overwrite or delete an ID photo through
-- the public API. With RLS on and no policy, that is exactly what happens.
--
-- Read paths are therefore admin-only by construction (lib/actions/admin.ts),
-- rather than by remembering to write the right policy.
