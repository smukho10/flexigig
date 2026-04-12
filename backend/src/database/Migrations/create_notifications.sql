CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    sender_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    receiver_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    job_id          INTEGER REFERENCES jobPostings(job_id) ON DELETE SET NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_receiver ON notifications(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_unread ON notifications(receiver_id, is_read);
ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS uq_notifications_receiver_job UNIQUE (receiver_id, job_id);
