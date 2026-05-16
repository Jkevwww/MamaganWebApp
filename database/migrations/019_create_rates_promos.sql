-- Migration 019: Seasonal rates, promotions, and booking discount audit fields

CREATE TABLE IF NOT EXISTS seasonal_rates (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  facility_id     INT UNSIGNED NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  rate_multiplier DECIMAL(6, 3) NOT NULL DEFAULT 1.000,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_seasonal_rates_window (start_date, end_date, active),
  INDEX idx_seasonal_rates_facility (facility_id)
);

CREATE TABLE IF NOT EXISTS promotions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(40) NOT NULL UNIQUE,
  title           VARCHAR(120) NOT NULL,
  description     TEXT NULL,
  facility_id     INT UNSIGNED NULL,
  discount_type   ENUM('PERCENT', 'FIXED') NOT NULL DEFAULT 'PERCENT',
  discount_value  DECIMAL(10, 2) NOT NULL,
  min_amount      DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  usage_limit     INT UNSIGNED NULL,
  used_count      INT UNSIGNED NOT NULL DEFAULT 0,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_promotions_window (start_date, end_date, active),
  INDEX idx_promotions_facility (facility_id)
);

SET @db_name = DATABASE();

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE bookings ADD COLUMN subtotal_amount DECIMAL(10, 2) NULL AFTER total_amount',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'subtotal_amount'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE bookings ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER subtotal_amount',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'discount_amount'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE bookings ADD COLUMN promo_code VARCHAR(40) NULL AFTER discount_amount',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'promo_code'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE bookings ADD COLUMN promo_id INT UNSIGNED NULL AFTER promo_code',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'promo_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE bookings ADD COLUMN seasonal_rate_id INT UNSIGNED NULL AFTER promo_id',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'seasonal_rate_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE bookings
SET subtotal_amount = total_amount
WHERE subtotal_amount IS NULL;
