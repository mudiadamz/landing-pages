-- Create storage bucket for landing page assets (images, videos)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-assets',
  'landing-assets',
  true,
  52428800,  -- 50MB
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS: users can upload/delete only in their own folder (user_id/path)
create policy "Users can upload own assets"
  on storage.objects for insert
  with check (
    bucket_id = 'landing-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own assets"
  on storage.objects for update
  using (
    bucket_id = 'landing-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own assets"
  on storage.objects for delete
  using (
    bucket_id = 'landing-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read (bucket is public)
create policy "Public can view assets"
  on storage.objects for select
  using (bucket_id = 'landing-assets');
