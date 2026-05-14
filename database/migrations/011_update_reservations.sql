-- Migration 011: Update facilities and bookings for advanced reservation system
ALTER TABLE facilities
  ADD COLUMN category ENUM('Cottage', 'Room', 'Equipment') NOT NULL DEFAULT 'Cottage',
  ADD COLUMN size VARCHAR(50) DEFAULT 'Standard',
  ADD COLUMN units INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN price_min DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN price_max DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN capacity_min INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN capacity_max INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN rental_type ENUM('FIXED', 'HOURLY', 'DAILY') NOT NULL DEFAULT 'FIXED',
  ADD COLUMN is_bookable TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN unavailable_reason TEXT;

-- Update existing data if any (standardized names to categories)
UPDATE facilities SET category = 'Cottage' WHERE name LIKE '%Cottage%';
UPDATE facilities SET category = 'Room' WHERE name LIKE '%Room%' OR name LIKE '%Cabana%';
UPDATE facilities SET category = 'Equipment' WHERE name LIKE '%Vest%' OR name LIKE '%Boat%' OR name LIKE '%Paddle%';

-- Update bookings table
ALTER TABLE bookings
  ADD COLUMN quantity INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN guest_count INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN booking_type ENUM('DAY', 'NIGHT', 'HOURLY', 'DAILY') NOT NULL DEFAULT 'DAY',
  ADD COLUMN payment_status ENUM('pending', 'paid', 'refunded', 'failed') NOT NULL DEFAULT 'pending',
  ADD COLUMN expires_at TIMESTAMP NULL;

-- Create blackout_periods table
CREATE TABLE IF NOT EXISTS blackout_periods (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  facility_id  INT UNSIGNED NULL, -- NULL means all facilities
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  reason       VARCHAR(255),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_blackout_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);
