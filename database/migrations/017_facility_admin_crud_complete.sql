-- Migration 017: Complete facilities schema for admin CRUD.
-- Additive and non-destructive; keeps legacy columns for compatibility.

CREATE TABLE IF NOT EXISTS facilities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  image_url TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'category'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE facilities ADD COLUMN category ENUM(''COTTAGE'',''CABANA'',''BEACH_EQUIPMENT'') NOT NULL DEFAULT ''COTTAGE'' AFTER name',
  'ALTER TABLE facilities MODIFY COLUMN category VARCHAR(50) NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE facilities SET category = 'COTTAGE' WHERE category IS NULL OR category IN ('Cottage', 'cottage', 'COTTAGE');
UPDATE facilities SET category = 'CABANA' WHERE category IN ('Room', 'room', 'Cabana', 'cabana', 'CABANA');
UPDATE facilities SET category = 'BEACH_EQUIPMENT' WHERE category IN ('Equipment', 'equipment', 'BEACH_EQUIPMENT');

ALTER TABLE facilities
  MODIFY COLUMN category ENUM('COTTAGE','CABANA','BEACH_EQUIPMENT') NOT NULL DEFAULT 'COTTAGE';

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'size'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE facilities ADD COLUMN size ENUM(''SMALL'',''MEDIUM'',''LARGE'',''EXTRA_LARGE'') NULL AFTER category',
  'ALTER TABLE facilities MODIFY COLUMN size VARCHAR(50) NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE facilities SET size = 'SMALL' WHERE size IN ('Small', 'small', 'SMALL');
UPDATE facilities SET size = 'MEDIUM' WHERE size IN ('Medium', 'medium', 'MEDIUM');
UPDATE facilities SET size = 'LARGE' WHERE size IN ('Large', 'large', 'LARGE');
UPDATE facilities SET size = 'EXTRA_LARGE' WHERE size IN ('Extra Large', 'Extra_Large', 'extra large', 'EXTRA LARGE', 'EXTRA_LARGE');
UPDATE facilities SET size = NULL WHERE category = 'BEACH_EQUIPMENT';

ALTER TABLE facilities
  MODIFY COLUMN size ENUM('SMALL','MEDIUM','LARGE','EXTRA_LARGE') NULL;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'inventory_count'
);
SET @legacy_units_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'units'
);
SET @sql := IF(@col_exists = 0 AND @legacy_units_exists = 1,
  'ALTER TABLE facilities CHANGE COLUMN units inventory_count INT UNSIGNED NOT NULL DEFAULT 0',
  IF(@col_exists = 0,
    'ALTER TABLE facilities ADD COLUMN inventory_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER image_url',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'capacity_min'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN capacity_min INT UNSIGNED NULL AFTER inventory_count', 'ALTER TABLE facilities MODIFY COLUMN capacity_min INT UNSIGNED NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'capacity_max'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN capacity_max INT UNSIGNED NULL AFTER capacity_min', 'ALTER TABLE facilities MODIFY COLUMN capacity_max INT UNSIGNED NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @legacy_capacity_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'capacity'
);
SET @sql := IF(@legacy_capacity_exists = 1,
  'UPDATE facilities SET capacity_min = COALESCE(capacity_min, 1), capacity_max = COALESCE(capacity_max, capacity)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'price_min'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN price_min DECIMAL(10,2) NULL AFTER capacity_max', 'ALTER TABLE facilities MODIFY COLUMN price_min DECIMAL(10,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'price_max'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN price_max DECIMAL(10,2) NULL AFTER price_min', 'ALTER TABLE facilities MODIFY COLUMN price_max DECIMAL(10,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @legacy_price_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'price_per_hour'
);
SET @sql := IF(@legacy_price_exists = 1,
  'UPDATE facilities SET price_min = COALESCE(price_min, price_per_hour), price_max = COALESCE(price_max, price_per_hour)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'day_rate_min'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN day_rate_min DECIMAL(10,2) NULL AFTER price_max', 'ALTER TABLE facilities MODIFY COLUMN day_rate_min DECIMAL(10,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'day_rate_max'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN day_rate_max DECIMAL(10,2) NULL AFTER day_rate_min', 'ALTER TABLE facilities MODIFY COLUMN day_rate_max DECIMAL(10,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE facilities
SET day_rate_min = COALESCE(day_rate_min, price_min),
    day_rate_max = COALESCE(day_rate_max, price_max)
WHERE category = 'CABANA';

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'night_surcharge_min'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN night_surcharge_min DECIMAL(10,2) NULL AFTER day_rate_max', 'ALTER TABLE facilities MODIFY COLUMN night_surcharge_min DECIMAL(10,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'night_surcharge_max'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN night_surcharge_max DECIMAL(10,2) NULL AFTER night_surcharge_min', 'ALTER TABLE facilities MODIFY COLUMN night_surcharge_max DECIMAL(10,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'hourly_rate'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN hourly_rate DECIMAL(10,2) NULL AFTER night_surcharge_max', 'ALTER TABLE facilities MODIFY COLUMN hourly_rate DECIMAL(10,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'daily_rate'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN daily_rate DECIMAL(10,2) NULL AFTER hourly_rate', 'ALTER TABLE facilities MODIFY COLUMN daily_rate DECIMAL(10,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE facilities
SET hourly_rate = COALESCE(hourly_rate, price_min),
    daily_rate = COALESCE(daily_rate, price_max)
WHERE category = 'BEACH_EQUIPMENT';

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'rental_type'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE facilities ADD COLUMN rental_type ENUM(''FIXED'',''HOURLY'',''DAILY'',''HOURLY_OR_DAILY'') NOT NULL DEFAULT ''FIXED'' AFTER daily_rate',
  'ALTER TABLE facilities MODIFY COLUMN rental_type ENUM(''FIXED'',''HOURLY'',''DAILY'',''HOURLY_OR_DAILY'') NOT NULL DEFAULT ''FIXED'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'active'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER rental_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @legacy_available_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'is_available'
);
SET @sql := IF(@legacy_available_exists = 1, 'UPDATE facilities SET active = is_available', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'bookable'
);
SET @legacy_bookable_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'is_bookable'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE facilities ADD COLUMN bookable TINYINT(1) NOT NULL DEFAULT 1 AFTER active',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@legacy_bookable_exists = 1, 'UPDATE facilities SET bookable = is_bookable', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'unavailable_reason'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN unavailable_reason TEXT NULL AFTER bookable', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'restricted_during_peak_hours'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN restricted_during_peak_hours TINYINT(1) NOT NULL DEFAULT 0 AFTER unavailable_reason', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND column_name = 'deleted_at'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE facilities ADD COLUMN deleted_at DATETIME NULL AFTER restricted_during_peak_hours', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE facilities
SET active = 0,
    bookable = 0,
    price_min = NULL,
    price_max = NULL,
    unavailable_reason = COALESCE(NULLIF(unavailable_reason, ''), 'Currently unavailable')
WHERE name = 'Medium Cottage' AND category = 'COTTAGE';

CREATE TABLE IF NOT EXISTS system_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100) NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(64) NULL,
  entity_type VARCHAR(50) NULL,
  entity_id INT UNSIGNED NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND index_name = 'idx_facilities_category'
);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_facilities_category ON facilities(category)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND index_name = 'idx_facilities_size'
);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_facilities_size ON facilities(size)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND index_name = 'idx_facilities_active'
);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_facilities_active ON facilities(active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND index_name = 'idx_facilities_bookable'
);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_facilities_bookable ON facilities(bookable)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'facilities' AND index_name = 'idx_facilities_deleted_at'
);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_facilities_deleted_at ON facilities(deleted_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
