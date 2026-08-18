-- Add missing application settings that the frontend expects
-- These settings are used by the Settings page (Application tab)

INSERT INTO settings (id, `key`, value, category, description) VALUES
  ('set-007', 'sessionTimeout', '30', 'application', 'Session timeout in minutes'),
  ('set-008', 'maxLoginAttempts', '5', 'application', 'Maximum login attempts before lockout'),
  ('set-009', 'passwordMinLength', '8', 'application', 'Minimum password length'),
  ('set-010', 'enableNotifications', 'true', 'application', 'Enable system notifications'),
  ('set-011', 'enableExport', 'true', 'application', 'Enable data export functionality')
ON DUPLICATE KEY UPDATE `key` = VALUES(`key`);