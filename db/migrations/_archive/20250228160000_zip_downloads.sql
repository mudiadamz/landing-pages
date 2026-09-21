-- Add zip_url to landing_pages (path in storage or full URL)
alter table public.landing_pages
  add column if not exists zip_url text default null;

-- Create storage bucket for ZIP downloads (private, signed URLs for security)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-downloads',
  'landing-downloads',
  false,
  52428800,
  array['application/zip', 'application/x-zip-compressed']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS: users can upload in their folder (user_id/page_id/file.zip)
create policy "Users can upload downloads in own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'landing-downloads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own downloads"
  on storage.objects for delete
  using (
    bucket_id = 'landing-downloads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role (signed URLs) bypasses RLS for reads
