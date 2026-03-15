-- Migration: Add job_templates table for employer template system
-- Date: 2026-03-15

CREATE TABLE IF NOT EXISTS job_templates (
    template_id    SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_name  VARCHAR(100) NOT NULL,
    job_title      VARCHAR(255),
    job_type       VARCHAR(100),
    job_description TEXT,
    hourly_rate    NUMERIC(10, 2),
    street_address VARCHAR(255),
    city           VARCHAR(100),
    province       VARCHAR(100),
    postal_code    VARCHAR(20),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_templates_user_id ON job_templates(user_id);
