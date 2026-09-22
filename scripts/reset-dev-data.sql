-- Wipe all app data from a dev database back to a clean slate, keeping the
-- schema and the user accounts (auth.users + lp_profiles). Truncates every
-- public.lp_* table except lp_profiles, so the admin/company account you use to
-- log in survives while sample products, sites, analytics, chats, purchases,
-- etc. are cleared.
--
--   docker compose -f compose.dev.yml exec -T db psql -U postgres -d lp \
--     -f - < scripts/reset-dev-data.sql
--
-- NOT for production: it empties every content and sales table.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'lp\_%'
      AND tablename <> 'lp_profiles'
    ORDER BY tablename
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
  END LOOP;
END $$;
