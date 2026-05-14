-- Migration 013: Finalize facility fields for admin CRUD
-- 1. Temporarily change category to VARCHAR to allow mapping
ALTER TABLE facilities MODIFY COLUMN category VARCHAR(50);

-- 2. Map existing categories to new standard
UPDATE facilities SET category = 'COTTAGE' WHERE category IN ('Cottage', 'COTTAGE');
UPDATE facilities SET category = 'CABANA' WHERE category IN ('Room', 'CABANA');
UPDATE facilities SET category = 'BEACH_EQUIPMENT' WHERE category IN ('Equipment', 'BEACH_EQUIPMENT');

-- 3. Now change to the final ENUM type
ALTER TABLE facilities 
  MODIFY COLUMN category ENUM('COTTAGE', 'CABANA', 'BEACH_EQUIPMENT') NOT NULL DEFAULT 'COTTAGE',
  CHANGE COLUMN units inventory_count INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN day_rate_min DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN day_rate_max DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN night_surcharge_min DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN night_surcharge_max DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN daily_rate DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN restricted_during_peak_hours TINYINT(1) NOT NULL DEFAULT 0;

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NULL,
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(50),
  entity_id    INT UNSIGNED,
  details      TEXT,
  ip_address   VARCHAR(45),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
