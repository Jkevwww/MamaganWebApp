-- Email verification for client registration.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_verified_at'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at, NOW())
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  purpose VARCHAR(40) NOT NULL DEFAULT 'REGISTRATION',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email_verification_email_purpose (email, purpose),
  INDEX idx_email_verification_expires_at (expires_at)
);
