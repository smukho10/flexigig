-- Migration: Add worker_id to schedule table
-- Task: US-7 Task 4 - Worker Profile Schedule Backend
--
-- Run this once in DBeaver on your local database.
-- This is additive only — no existing tables or columns are changed.

ALTER TABLE schedule
  ADD COLUMN IF NOT EXISTS worker_id INTEGER
  REFERENCES workers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schedule_worker_id ON schedule(worker_id);
