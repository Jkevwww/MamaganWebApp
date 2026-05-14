-- Migration 005: safe update users table for local email/password auth
-- Non-destructive: adds missing columns using dynamic SQL (MySQL-agnostic).

DELIMITER $$

BEGIN
  -- Ensure phone
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'phone'
  ) THEN
    SET @sql = 'ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  -- Ensure password_hash
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'password_hash'
  ) THEN
    SET @sql = 'ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  -- Ensure role
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'role'
  ) THEN
    SET @sql = "ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'GUEST'";
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  -- Ensure access_tier
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'access_tier'
  ) THEN
    SET @sql = 'ALTER TABLE users ADD COLUMN access_tier VARCHAR(50) NULL';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  -- Ensure avatar_url
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'avatar_url'
  ) THEN
    SET @sql = 'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  -- Ensure active
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'active'
  ) THEN
    SET @sql = 'ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  -- Ensure last_login_at
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'last_login_at'
  ) THEN
    SET @sql = 'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  -- Ensure created_at
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'created_at'
  ) THEN
    SET @sql = 'ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  -- Ensure updated_at
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'updated_at'
  ) THEN
    SET @sql = 'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

END$$

DELIMITER ;

