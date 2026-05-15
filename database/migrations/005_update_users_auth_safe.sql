-- Superseded by 008_update_users_auth_columns_compat.sql and
-- 016_unified_login_admin_bootstrap.sql.
--
-- This migration is intentionally a no-op because its original version used
-- DELIMITER / procedural SQL, which mysql2/promise does not parse the same way
-- as the mysql command-line client.

SELECT 1;
