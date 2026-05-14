-- Migration 012: Create payments, tickets, and webhook_events tables

-- 1. Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id            INT UNSIGNED NOT NULL,
  provider              VARCHAR(50) NOT NULL DEFAULT 'paymongo',
  payment_method        VARCHAR(50),
  provider_checkout_id  VARCHAR(255),
  provider_payment_id   VARCHAR(255),
  gcash_ref_no          VARCHAR(255),
  amount                DECIMAL(10, 2) NOT NULL,
  status                ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  raw_payload           JSON,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 2. Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id   INT UNSIGNED NOT NULL UNIQUE,
  qr_token     VARCHAR(255) NOT NULL UNIQUE,
  status       ENUM('valid', 'used', 'expired') NOT NULL DEFAULT 'valid',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_ticket_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 3. Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider      VARCHAR(50) NOT NULL,
  event_id      VARCHAR(255) NOT NULL UNIQUE,
  event_type    VARCHAR(100) NOT NULL,
  processed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  raw_payload   JSON
);
