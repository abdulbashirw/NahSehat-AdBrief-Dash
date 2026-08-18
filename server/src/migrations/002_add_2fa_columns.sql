-- Migration: Add 2FA columns to users table
-- Run manually: mysql -u root -p nahsehat_analytics_dash < server/src/migrations/002_add_2fa_columns.sql

ALTER TABLE users
  ADD COLUMN two_factor_secret VARCHAR(255) NULL AFTER phone,
  ADD COLUMN two_factor_enabled TINYINT(1) DEFAULT 0 AFTER two_factor_secret;