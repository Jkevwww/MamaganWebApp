-- Create user-to-admin support chat tables.

CREATE TABLE IF NOT EXISTS chat_threads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  last_message_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_threads_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  UNIQUE KEY uq_chat_threads_user (user_id),
  KEY idx_chat_threads_status_last_message (status, last_message_at)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id INT UNSIGNED NOT NULL,
  sender_id INT UNSIGNED NULL,
  sender_type ENUM('USER', 'ADMIN') NOT NULL,
  message TEXT NOT NULL,
  read_by_user_at DATETIME NULL,
  read_by_admin_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_messages_thread
    FOREIGN KEY (thread_id) REFERENCES chat_threads(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_chat_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(id)
    ON DELETE SET NULL,
  KEY idx_chat_messages_thread_created (thread_id, created_at),
  KEY idx_chat_messages_admin_unread (thread_id, sender_type, read_by_admin_at),
  KEY idx_chat_messages_user_unread (thread_id, sender_type, read_by_user_at)
);
