-- Migration 002: Create facilities table
CREATE TABLE IF NOT EXISTS facilities (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  capacity        INT UNSIGNED NOT NULL DEFAULT 1,
  price_per_hour  DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  image_url       VARCHAR(500),
  is_available    TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
