CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,

    reviewer_id INT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reviewee_id INT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    rating INT
        CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),

    review_text TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Prevent self-review
    CONSTRAINT no_self_review
        CHECK (reviewer_id <> reviewee_id),

    -- Prevent duplicate review from same reviewer to same reviewee
    CONSTRAINT unique_reviewer_reviewee
        UNIQUE (reviewer_id, reviewee_id),

    -- Prevent completely empty review row
    CONSTRAINT at_least_one_field
        CHECK (rating IS NOT NULL OR review_text IS NOT NULL)
);