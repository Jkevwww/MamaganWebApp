-- Migration 006: safe update users table for local email/password auth (MySQL-safe)
-- Purpose: avoid unsupported "ADD COLUMN IF NOT EXISTS" in some MySQL versions.
-- Non-destructive: only adds missing columns.

DELIMITER $$

CREATE PROCEDURE add_column_if_missing(
  IN p_column_name VARCHAR(64),
  IN p_column_def TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = p_column_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE users ADD COLUMN ', p_column_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- Add columns (idempotent)
CALL add_column_if_missing('phone', 'phone VARCHAR(50) NULL');
CALL add_column_if_missing('password_hash', 'password_hash VARCHAR(255) NULL');
CALL add_column_if_missing('role', "role VARCHAR(50) NOT NULL DEFAULT 'GUEST'");
CALL add_column_if_missing('access_tier', 'access_tier VARCHAR(50) NULL');
CALL add_column_if_missing('avatar_url', 'avatar_url VARCHAR(255) NULL');
CALL add_column_if_missing('active', 'active BOOLEAN NOT NULL DEFAULT TRUE');
CALL add_column_if_missing('last_login_at', 'last_login_at DATETIME NULL');
CALL add_column_if_missing('created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

DROP PROCEDURE IF EXISTS add_column_if_missing;

