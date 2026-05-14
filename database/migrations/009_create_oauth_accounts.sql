-- OAuth accounts table for linking external identities to internal users

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  provider ENUM('GOOGLE','GITHUB') NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id),
  INDEX(user_id),
  CONSTRAINT fk_oauth_accounts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

