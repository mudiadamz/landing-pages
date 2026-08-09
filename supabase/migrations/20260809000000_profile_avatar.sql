-- Avatar for a person, alongside the icon a SITE already has (lp_sites.icon_url).
--
-- Public URL into the `landing-assets` bucket under `avatars/<user id>/`, the
-- same shape site branding uses. NULL means no picture, which is the normal
-- state and not an error: everywhere an avatar renders already falls back to the
-- initial letter, and that fallback stays the design for anyone who never sets
-- one.
--
-- Every role gets one. There is no admin-only or seller-only gate here, because
-- the surfaces that show it — the panel sidebar card, the profile screen — are
-- the same for a buyer, a publisher and an admin.

alter table lp_profiles
  add column if not exists avatar_url text;

comment on column lp_profiles.avatar_url is
  'Public URL of the user''s avatar in landing-assets/avatars/<user id>/. NULL = fall back to the initial letter.';
