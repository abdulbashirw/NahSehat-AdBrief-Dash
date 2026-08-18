-- Add login attempt tracking columns to users table
ALTER TABLE users
  ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0 AFTER two_factor_enabled,
  ADD COLUMN locked_until DATETIME NULL AFTER failed_login_attempts;