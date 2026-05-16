-- Migration 018: Add manual audit references for tickets

ALTER TABLE tickets
  ADD COLUMN reference_number VARCHAR(64) NULL AFTER qr_token,
  ADD COLUMN checked_in_at TIMESTAMP NULL AFTER status,
  ADD COLUMN checked_in_by INT UNSIGNED NULL AFTER checked_in_at,
  ADD UNIQUE KEY uq_tickets_reference_number (reference_number);

UPDATE tickets
SET reference_number = CONCAT('MAM-', booking_id, '-', UPPER(SUBSTRING(REPLACE(qr_token, '-', ''), 1, 8)))
WHERE reference_number IS NULL;

ALTER TABLE tickets
  MODIFY reference_number VARCHAR(64) NOT NULL;
