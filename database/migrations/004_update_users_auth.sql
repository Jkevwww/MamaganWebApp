-- Superseded by 008_update_users_auth_columns_compat.sql and
-- 016_unified_login_admin_bootstrap.sql.
--
-- This migration is intentionally a no-op because its original version used
-- ADD COLUMN IF NOT EXISTS, which is not portable across the MySQL variants
-- used by Aiven and local environments.

SELECT 1;
