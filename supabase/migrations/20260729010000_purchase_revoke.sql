-- Let an admin take back access to a product without erasing that it was sold.
--
-- A soft flag rather than a delete: the row carries the invoice number, the
-- amount and the payment method, and lp_purchases_sold_count_trigger counts it.
-- Deleting would quietly rewrite revenue history and a product's sold_count to
-- undo something that is usually a support decision, not a bookkeeping one.
alter table lp_purchases
  add column if not exists revoked_at  timestamptz,
  add column if not exists revoked_by  uuid references auth.users (id) on delete set null,
  add column if not exists revoke_reason text;

-- Enforced in RLS, not in each query.
--
-- Six separate places gate on ownership — the reader page, the ZIP download, the
-- PDF and EPUB file routes, the owned-text route and the post-checkout screen —
-- and every one of them reads through the user's own client. Putting the rule in
-- the policy revokes all six at once and, more to the point, means the seventh
-- one someone adds next month is covered without being told about this.
--
-- The service-role client bypasses RLS, so the panel and the Duitku callback
-- still see revoked rows; that is what lets an admin undo this, and what stops a
-- re-purchase from colliding with the unique(user_id, landing_page_id) index.
drop policy if exists "Users can read own purchases" on lp_purchases;
create policy "Users can read own purchases"
  on lp_purchases for select
  using (auth.uid() = user_id and revoked_at is null);

-- Only ever queried as "the revoked ones", which stay a small minority.
create index if not exists lp_purchases_revoked_at_idx
  on lp_purchases (revoked_at)
  where revoked_at is not null;
