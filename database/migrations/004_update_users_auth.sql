-- Migration 004: update users table for local auth (non-destructive)

-- Add missing fields without destroying existing data.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'GUEST',
  ADD COLUMN IF NOT EXISTS access_tier VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL;

-- Ensure timestamps exist (legacy table might already have them)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- If legacy column `password` exists, keep it for backward compatibility.
-- Code will fall back to it when `password_hash` is NULL.

