-- Migration 022: Facility reviews with photo/video attachments.

CREATE TABLE IF NOT EXISTS facility_reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  facility_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  booking_id INT UNSIGNED NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_facility_reviews_user_facility (facility_id, user_id),
  INDEX idx_facility_reviews_facility_created (facility_id, created_at),
  CONSTRAINT fk_facility_reviews_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT fk_facility_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_facility_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  CONSTRAINT chk_facility_reviews_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS facility_review_media (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  review_id INT UNSIGNED NOT NULL,
  media_type ENUM('image', 'video') NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(120) NULL,
  file_size INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_facility_review_media_review (review_id),
  CONSTRAINT fk_facility_review_media_review FOREIGN KEY (review_id) REFERENCES facility_reviews(id) ON DELETE CASCADE
);
