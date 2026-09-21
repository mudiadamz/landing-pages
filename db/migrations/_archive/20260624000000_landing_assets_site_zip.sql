-- Allow full website bundles (uploaded via ZIP) to live in the landing-assets
-- bucket. Previously only image/video MIME types were permitted, which rejected
-- HTML, CSS, JS and font files. Removing the allow-list lets a site's relative
-- assets be served verbatim. The bucket stays public-read and per-user RLS on
-- writes (path must start with auth.uid()) is unchanged.
update storage.buckets
set allowed_mime_types = null
where id = 'landing-assets';
