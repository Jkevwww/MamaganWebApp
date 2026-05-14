-- Migration 003: Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  facility_id  INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  date         DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  notes        TEXT,
  status       ENUM('pending', 'approved', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_booking_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_user     FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE
);
