-- Extend system_logs for structured auth / OAuth auditing (additive, non-destructive).

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'system_logs'
    AND column_name = 'module'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE system_logs ADD COLUMN module VARCHAR(100) NULL AFTER action', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'system_logs'
    AND column_name = 'target_type'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE system_logs ADD COLUMN target_type VARCHAR(50) NULL AFTER module', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'system_logs'
    AND column_name = 'target_id'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE system_logs ADD COLUMN target_id VARCHAR(64) NULL AFTER target_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'system_logs'
    AND column_name = 'user_agent'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE system_logs ADD COLUMN user_agent VARCHAR(512) NULL AFTER ip_address', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
