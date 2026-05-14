-- Minimal users schema for OAuth login
-- Run this on your MySQL (Aiven) database.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider ENUM('google','github') NOT NULL,
  providerId VARCHAR(191) NOT NULL,
  email VARCHAR(191) NULL,
  name VARCHAR(191) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_provider_providerId (provider, providerId),
  KEY idx_email (email)
) ENGINE=InnoDB;

