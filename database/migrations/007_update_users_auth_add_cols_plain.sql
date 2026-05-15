-- Superseded by 008_update_users_auth_columns_compat.sql and
-- 016_unified_login_admin_bootstrap.sql.
--
-- This migration is intentionally a no-op because its original dynamic SQL
-- string quoting was not portable on MySQL servers using ANSI_QUOTES.

SELECT 1;
