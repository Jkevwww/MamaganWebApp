-- Unified login compatibility updates.
-- Additive/non-destructive: preserves existing users and widens legacy role values.

ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;
ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'GUEST';

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'phone'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'password_hash'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'access_tier'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN access_tier VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_url'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'active'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'last_login_at'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE users SET role = 'GUEST' WHERE LOWER(role) = 'user';
UPDATE users SET role = 'ADMIN', access_tier = COALESCE(access_tier, 'SUPER_ADMIN') WHERE LOWER(role) = 'admin';
UPDATE users SET access_tier = 'GUEST' WHERE access_tier IS NULL AND role = 'GUEST';

CREATE TABLE IF NOT EXISTS system_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100) NULL,
  entity_type VARCHAR(50) NULL,
  entity_id INT UNSIGNED NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(64) NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_system_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
