ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS contact_first_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_last_name VARCHAR(255);
