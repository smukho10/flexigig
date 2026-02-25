-- Migration: Allow null values in locations table for draft job postings
-- Date: 2026-02-24

ALTER TABLE locations ALTER COLUMN city DROP NOT NULL;
ALTER TABLE locations ALTER COLUMN province DROP NOT NULL;
ALTER TABLE locations ALTER COLUMN postalcode DROP NOT NULL;