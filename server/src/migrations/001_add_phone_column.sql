-- Migration: Add phone column to users table
-- Run manually: mysql -u root -p nahsehat_analytics_dash < server/src/migrations/001_add_phone_column.sql

ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL AFTER email;