-- The landing-downloads bucket allowed only ZIP + PDF mime types, so the
-- service-role upload of an EPUB deliverable (contentType application/epub+zip)
-- was rejected at the storage layer. Add EPUB to the allow-list.
update storage.buckets
  set allowed_mime_types = array[
    'application/zip',
    'application/x-zip-compressed',
    'application/pdf',
    'application/epub+zip'
  ]
  where id = 'landing-downloads';
