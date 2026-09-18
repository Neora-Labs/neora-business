-- Run manually with psql after replacing each Clerk user ID.
-- Example:
-- psql "$DATABASE_URL" \
--   -v administrator_clerk_id='user_admin' \
--   -v analyst_clerk_id='user_analyst' \
--   -v commercial_partner_clerk_id='user_commercial' \
--   -v technical_partner_clerk_id='user_technical' \
--   -f packages/db/seeds/roles.sql

BEGIN;

INSERT INTO users (clerk_user_id, role)
VALUES
  (:'administrator_clerk_id', 'administrator'),
  (:'analyst_clerk_id', 'analyst'),
  (:'commercial_partner_clerk_id', 'commercial_partner'),
  (:'technical_partner_clerk_id', 'technical_partner')
ON CONFLICT (clerk_user_id) DO UPDATE SET role = EXCLUDED.role;

COMMIT;
