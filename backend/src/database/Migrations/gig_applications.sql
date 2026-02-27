-- Track applications a worker (user) makes to a gig (jobPostings)
CREATE TABLE gig_applications (
  application_id     SERIAL PRIMARY KEY,

  -- This must match jobPostings PK: job_id
  job_id             INT NOT NULL
    REFERENCES jobPostings(job_id)
    ON DELETE CASCADE,

  -- This must match users PK: id
  employer_id     INT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  -- This must match workers PK: id (sub-profile)
  worker_profile_id  INT NOT NULL
    REFERENCES workers(id)
    ON DELETE CASCADE,

  -- status stored as plain text (backend controls values)
  status             TEXT NOT NULL DEFAULT 'APPLIED',

  applied_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()

);

-- Prevent more than one ACTIVE application per (job_id, worker_user_id)
-- Allows re-apply after CANCELLED/WITHDRAWN/REJECTED
CREATE UNIQUE INDEX ux_one_active_application_per_user_per_job
  ON gig_applications (job_id, employer_id)
  WHERE status IN ('APPLIED','IN_REVIEW','ACCEPTED');

-- Helpful indexes
CREATE INDEX idx_gig_applications_job_id ON gig_applications (job_id);
CREATE INDEX idx_gig_applications_employer_id ON gig_applications (employer_id);
CREATE INDEX idx_gig_applications_worker_profile_id ON gig_applications (worker_profile_id);