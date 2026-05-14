-- Migration 007: add missing users auth columns (plain SQL)
-- NOTE: Migration 007 may be incompatible on some MySQL variants.
-- It is kept for backward compatibility, but should be superseded by:
--   - 008_update_users_auth_columns_compat.sql
--
-- This file now becomes a no-op to avoid breaking migration runs.


-- phone
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='phone') = 0,
  'ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- password_hash
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='password_hash') = 0,
  'ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- role
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='role') = 0,
  "ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'GUEST'",
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;



-- access_tier
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='access_tier') = 0,
  'ALTER TABLE users ADD COLUMN access_tier VARCHAR(50) NULL',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- avatar_url
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='avatar_url') = 0,
  'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- active
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='active') = 0,
  'ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- last_login_at
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='last_login_at') = 0,
  'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_at
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='created_at') = 0,
  'ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- updated_at
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name='users' AND column_name='updated_at') = 0,
  'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

