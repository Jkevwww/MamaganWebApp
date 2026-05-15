-- Superseded by 008_update_users_auth_columns_compat.sql and
-- 016_unified_login_admin_bootstrap.sql.
--
-- This migration is intentionally a no-op because its original version used
-- DELIMITER / CREATE PROCEDURE syntax. DELIMITER is a mysql CLI directive, not
-- SQL understood by mysql2/promise.

SELECT 1;
