-- Extra product images, shown as a swipeable gallery on the checkout page
-- alongside the main (landscape or portrait) thumbnail. Capped at two here so a
-- product never has more than three slides.
alter table lp_landing_pages
  add column if not exists thumbnail_extra_urls text[];
