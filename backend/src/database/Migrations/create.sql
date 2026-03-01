DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS pending_users CASCADE;
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS business_verification_tokens CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS workers_skills CASCADE;
DROP TABLE IF EXISTS experiences CASCADE;
DROP TABLE IF EXISTS workers_experiences CASCADE;
DROP TABLE IF EXISTS traits CASCADE;
DROP TABLE IF EXISTS workers_traits CASCADE;
DROP TABLE IF EXISTS schedule CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS jobPostings CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;

CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    StreetAddress VARCHAR(255),
    city VARCHAR(255) NOT NULL,
    province VARCHAR(255) NOT NULL,
    postalCode VARCHAR(20) NOT NULL
);

CREATE TABLE pending_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    account_type TEXT NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    business_name VARCHAR(255),
    business_description TEXT,
    phone_number VARCHAR(20),
    photo VARCHAR(255),
    street_address VARCHAR(255),
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    skills JSONB,
    experiences JSONB,
    traits JSONB,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(60) NOT NULL,
    active BOOLEAN DEFAULT false,
    signUpDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    isBusiness BOOLEAN DEFAULT false,
    userImage VARCHAR(255),
    user_phone_number VARCHAR(25),
    user_address INT,
    profile_photo_key VARCHAR(255),
    current_session_id TEXT,
    session_last_seen TIMESTAMPTZ,
    CONSTRAINT fk_user_address FOREIGN KEY(user_address) REFERENCES locations(location_id)
);

CREATE TABLE verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) UNIQUE NOT NULL,
    expiration_time TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE business_verification_tokens (
    id SERIAL PRIMARY KEY,
    business_id INT REFERENCES users(id) ON DELETE CASCADE,
    isVerified BOOLEAN DEFAULT false
);

CREATE TABLE schedule (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    startDate TIMESTAMP,
    endDate TIMESTAMP,
    startTime TIME,
    endTime TIME,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE workers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  profile_name VARCHAR(100) NOT NULL DEFAULT 'Profile 1',
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  biography TEXT,
  desired_work_radius INT,
  desired_pay DECIMAL(10, 2),
  schedule_id INTEGER REFERENCES schedule(id) ON DELETE SET NULL
);

CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(100),
  business_description TEXT,
  business_email VARCHAR(100),
  business_website VARCHAR(255)
);

CREATE TABLE jobPostings (
    job_id SERIAL PRIMARY KEY,
    jobTitle VARCHAR(255),
    jobType VARCHAR(50),
    jobDescription TEXT,
    hourlyRate DECIMAL(10, 2),
    jobStart TIMESTAMP WITHOUT TIME ZONE,
    jobEnd TIMESTAMP WITHOUT TIME ZONE,
    jobPostedDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    jobfilled BOOLEAN,
    location_id INT,
    user_id INT,
    applicant_id INT DEFAULT NULL,
    CONSTRAINT fk_job_posting_location
        FOREIGN KEY (location_id)
        REFERENCES locations(location_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_job_posting_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE skills (
    skill_id SERIAL PRIMARY KEY,
    skill_name VARCHAR(255) UNIQUE
);

CREATE TABLE workers_skills (
    workers_skills_id SERIAL PRIMARY KEY,
    workers_id INT,
    skill_id INT,
    CONSTRAINT fk_workers FOREIGN KEY(workers_id) REFERENCES workers(id),
    CONSTRAINT fk_skills FOREIGN KEY(skill_id) REFERENCES skills(skill_id)
);

CREATE TABLE experiences (
    experience_id SERIAL PRIMARY KEY,
    experience_name VARCHAR(255) UNIQUE
);

CREATE TABLE workers_experiences (
    workers_experiences_id SERIAL PRIMARY KEY,
    workers_id INT,
    experience_id INT,
    CONSTRAINT fk_workers FOREIGN KEY(workers_id) REFERENCES workers(id),
    CONSTRAINT fk_experience FOREIGN KEY(experience_id) REFERENCES experiences(experience_id)
);

CREATE TABLE traits (
    trait_id SERIAL PRIMARY KEY,
    trait_name VARCHAR(255) UNIQUE
);

CREATE TABLE workers_traits (
    workers_traits_id SERIAL PRIMARY KEY,
    workers_id INT,
    trait_id INT,
    CONSTRAINT fk_workers FOREIGN KEY(workers_id) REFERENCES workers(id),
    CONSTRAINT fk_traits FOREIGN KEY(trait_id) REFERENCES traits(trait_id)
);

CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    job_id INT REFERENCES jobPostings(job_id) ON DELETE SET NULL,
    is_system BOOLEAN DEFAULT FALSE
);

-- Reviews table
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

    CONSTRAINT no_self_review
        CHECK (reviewer_id <> reviewee_id),

    CONSTRAINT unique_reviewer_reviewee
        UNIQUE (reviewer_id, reviewee_id),

    CONSTRAINT at_least_one_field
        CHECK (rating IS NOT NULL OR review_text IS NOT NULL)
);