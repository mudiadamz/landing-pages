-- Buy-now CTA can now trigger an "add to calendar" action (.ics) in addition to
-- checkout / external link. cta_action is the discriminator; event_* hold the
-- calendar event details (times stored as floating local datetime strings, e.g.
-- "2026-08-01T14:00", so no timezone conversion happens on the way to the .ics).
alter table lp_landing_pages
  add column if not exists cta_action text default null,
  add column if not exists event_title text default null,
  add column if not exists event_start text default null,
  add column if not exists event_end text default null,
  add column if not exists event_location text default null,
  add column if not exists event_description text default null;
