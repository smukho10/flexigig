-- Migration: Add required_skills and required_experience to jobpostings
-- Run this SQL against your flexigig_backend_posgres database
 
ALTER TABLE jobPostings
  ADD COLUMN IF NOT EXISTS required_skills    text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_experience text[] DEFAULT '{}';