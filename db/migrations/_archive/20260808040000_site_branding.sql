-- Per-storefront logo and icon.
--
-- Two columns, not one, because they are different shapes doing different jobs:
--   logo_url  wide wordmark, sits in a ~28px-tall header slot next to the nav
--   icon_url  square mark: browser tab, PWA install, iOS home screen, bio avatar
-- One column for both would mean either a cropped wordmark in the browser tab or
-- a postage stamp in the header.
--
-- Public URLs into the landing-assets bucket, not stored bytes. NULL on both means
-- "use the ADM.UIUX defaults", which is what every existing row wants.
alter table public.lp_sites
  add column if not exists logo_url text default null,
  add column if not exists icon_url text default null;

comment on column public.lp_sites.logo_url is
  'Public URL of the wide/wordmark logo shown in the header. NULL = ADM.UIUX default mark.';
comment on column public.lp_sites.icon_url is
  'Public URL of the square icon used for favicon, PWA manifest, apple-touch-icon and the link-in-bio avatar. NULL = ADM.UIUX default.';
