-- Migration 021: Admin-managed application settings.

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_settings (setting_key, setting_value)
VALUES
  ('resort_profile', '{"resort_name":"Mamagan Fun & Adventure Beach Resort","support_email":"fieljeromekevin@gmail.com","support_phone":"0967 255 0423","address":"Calag-itan, Hinunangan, Southern Leyte","business_hours":"8:00 AM - 6:00 PM","website_url":""}'),
  ('booking_rules', '{"check_in_time":"08:00","check_out_time":"18:00","min_advance_hours":2,"max_guest_per_booking":50,"auto_approve_paid_bookings":true,"require_paid_check_in":true}'),
  ('notifications', '{"booking_alerts":true,"payment_updates":true,"check_in_alerts":true,"daily_summary":false,"admin_email":"fieljeromekevin@gmail.com"}')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
