-- Migration: Add OAuth support columns to users table
-- Run this migration to enable Google (and future OAuth) login

-- Make password nullable for OAuth users (they don't have passwords)
ALTER TABLE users
  ALTER COLUMN password DROP NOT NULL;

-- Add auth_provider column to track how user registered
-- Values: 'local' (email/password), 'google', 'facebook', 'apple'
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local';

-- Add google_id column to store Google's unique user identifier
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Update existing users to have 'local' auth_provider
UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL;

-- Add index for faster Google ID lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
