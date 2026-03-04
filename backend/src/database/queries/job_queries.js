// backend/src/database/queries/job_queries.js
const db = require("../connection.js");

const insertLocation = async ({
  jobStreetAddress,
  jobCity,
  jobProvince,
  jobPostalCode,
}) => {
  const locationQuery = `
    INSERT INTO locations (StreetAddress, city, province, postalCode)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  try {
    const locationResult = await db.query(locationQuery, [
      jobStreetAddress || null,
      jobCity || null,
      jobProvince || null,
      jobPostalCode || null,
    ]);
    return locationResult.rows[0];
  } catch (err) {
    console.error("Error inserting location:", err);
    throw err;
  }
};

// status param added — defaults to 'open' if not provided
const postJob = async ({
  jobTitle,
  jobType,
  jobDescription,
  hourlyRate,
  jobStart,
  jobEnd,
  location_id,
  user_id,
  status = "open",
}) => {
  const jobQuery = `
    INSERT INTO jobPostings (
      jobTitle, jobType, jobDescription, hourlyRate, jobStart, jobEnd, location_id, user_id, jobfilled, status
    ) VALUES ($1, $2, $3, $4::numeric, $5::timestamp, $6::timestamp, $7, $8, false, $9)
    RETURNING *;
  `;

  try {
    const jobResult = await db.query(jobQuery, [
      jobTitle,
      jobType,
      jobDescription,
      hourlyRate || null,
      jobStart || null,
      jobEnd || null,
      location_id,
      user_id,
      status,
    ]);
    return jobResult.rows[0];
  } catch (err) {
    console.error("Error posting job:", err);
    throw err;
  }
};

// status now included in SELECT via jp.*  (it's already covered by the wildcard)
const fetchPostedJobsByUserId = async (userId) => {
  const query = `
    SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    WHERE jp.user_id = $1;
  `;
  try {
    const result = await db.query(query, [userId]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching posted jobs by user ID:", err);
    throw err;
  }
};

const fetchUnfilledJobsByUserId = async (userId) => {
  const query = `
    SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    WHERE jp.user_id = $1 AND jp.jobfilled = false;
  `;
  try {
    const result = await db.query(query, [userId]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching unfilled jobs by user ID:", err);
    throw err;
  }
};

const fetchFilledJobsByUserId = async (userId) => {
  const query = `
    SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    WHERE jp.user_id = $1 AND jp.jobfilled = true;
  `;
  try {
    const result = await db.query(query, [userId]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching filled jobs by user ID:", err);
    throw err;
  }
};

const fetchJobByJobId = async (jobId) => {
  const query = `
    SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    WHERE jp.job_id = $1;
  `;
  try {
    const result = await db.query(query, [parseInt(jobId, 10)]);
    return result.rows[0];
  } catch (err) {
    console.error("Error fetching job by job ID:", err);
    throw err;
  }
};

// status param added to updateJob
const updateJob = async (
  jobId,
  {
    jobTitle,
    jobType,
    jobDescription,
    hourlyRate,
    jobStart,
    jobEnd,
    locationData,
    user_id,
    status,
  }
) => {
  try {
    const locationUpdateQuery = `
      UPDATE locations
      SET StreetAddress = $1, city = $2, province = $3, postalCode = $4
      FROM jobPostings
      WHERE locations.location_id = jobPostings.location_id AND jobPostings.job_id = $5;
    `;
    await db.query(locationUpdateQuery, [
      locationData?.streetAddress || null,
      locationData?.city || null,
      locationData?.province || null,
      locationData?.postalCode || null,
      jobId,
    ]);

    const jobUpdateQuery = `
      UPDATE jobPostings
      SET jobTitle = $1, jobType = $2, jobDescription = $3, hourlyRate = $4::numeric, jobStart = $5::timestamp, jobEnd = $6::timestamp, status = $7
      WHERE job_id = $8 AND user_id = $9
      RETURNING *;
    `;
    const result = await db.query(jobUpdateQuery, [
      jobTitle,
      jobType,
      jobDescription,
      hourlyRate || null,
      jobStart || null,
      jobEnd || null,
      status,
      jobId,
      user_id,
    ]);

    return result.rows[0];
  } catch (err) {
    console.error("Error updating job and location:", err);
    throw err;
  }
};

// NEW: just updates the status column for a job
const updateJobStatus = async (jobId, status) => {
  const query = `
    UPDATE jobPostings
    SET status = $1
    WHERE job_id = $2
    RETURNING *;
  `;
  try {
    const result = await db.query(query, [status, jobId]);
    return result.rows[0];
  } catch (err) {
    console.error("Error updating job status:", err);
    throw err;
  }
};

const deleteJobById = async (jobId) => {
  const query = `
    DELETE FROM jobPostings
    WHERE job_id = $1;
  `;
  try {
    await db.query(query, [jobId]);
    return { message: "Job successfully deleted" };
  } catch (err) {
    console.error("Error deleting job:", err);
    throw err;
  }
};

const fetchAllJobs = async (input = {}) => {
  const isNewShape =
    input &&
    typeof input === "object" &&
    Object.prototype.hasOwnProperty.call(input, "filters");

  const filters = isNewShape ? input.filters || {} : input || {};
  const page = isNewShape ? input.page : 1;
  const perPage = isNewShape ? input.perPage : 10;

  const pageNum = Number.isInteger(page) && page >= 1 ? page : 1;
  const limitNum = [10, 20].includes(perPage) ? perPage : 10;
  const offsetNum = (pageNum - 1) * limitNum;

  const SORT_COLUMNS = {
    jobPostedDate: "jp.jobposteddate", // main behavior
    jobStart: "jp.jobStart",
    hourlyRate: "jp.hourlyRate",
    jobId: "jp.job_id",
  };

  // Default to newest posted first (same as main)
  const sortBy =
    SORT_COLUMNS[filters.sortBy] ? filters.sortBy : "jobPostedDate";
  const sortOrder =
    String(filters.sortOrder || "desc").toLowerCase() === "asc"
      ? "ASC"
      : "DESC";
  const orderClause = `ORDER BY ${SORT_COLUMNS[sortBy]} ${sortOrder}, jp.job_id DESC`;

  // Base query
  let baseQuery = `
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    LEFT JOIN businesses bs ON jp.user_id = bs.user_id
    WHERE 1=1
  `;

  const params = [];

  const statusList =
    Array.isArray(filters.status) && filters.status.length > 0
      ? filters.status
      : null;

  const statusIncludesFilledLike =
    statusList &&
    statusList.some((s) =>
      ["filled", "complete", "completed"].includes(String(s).toLowerCase())
    );

  if (!statusList) {
    baseQuery += `
      AND jp.jobfilled = false
      AND jp.status NOT IN ('draft', 'filled', 'complete', 'completed')
    `;
  } else {
    if (!statusIncludesFilledLike) {
      baseQuery += ` AND jp.jobfilled = false`;
    }
    baseQuery += ` AND jp.status = ANY($${params.length + 1})`;
    params.push(statusList);
  }

  if (filters.jobType) {
    baseQuery += ` AND jp.jobType = $${params.length + 1}`;
    params.push(filters.jobType);
  }

  if (filters.userId) {
    baseQuery += ` AND jp.user_id = $${params.length + 1}`;
    params.push(filters.userId);
  }

  if (filters.hourlyRateMin != null) {
    baseQuery += ` AND jp.hourlyRate >= $${params.length + 1}::numeric`;
    params.push(filters.hourlyRateMin);
  }
  if (filters.hourlyRateMax != null) {
    baseQuery += ` AND jp.hourlyRate <= $${params.length + 1}::numeric`;
    params.push(filters.hourlyRateMax);
  }

  if (filters.startFrom) {
    baseQuery += ` AND jp.jobStart >= $${params.length + 1}::timestamp`;
    params.push(filters.startFrom);
  }
  if (filters.startTo) {
    baseQuery += ` AND jp.jobStart <= $${params.length + 1}::timestamp`;
    params.push(filters.startTo);
  }

  if (filters.endFrom) {
    baseQuery += ` AND jp.jobEnd >= $${params.length + 1}::timestamp`;
    params.push(filters.endFrom);
  }
  if (filters.endTo) {
    baseQuery += ` AND jp.jobEnd <= $${params.length + 1}::timestamp`;
    params.push(filters.endTo);
  }

  if (filters.city) {
    baseQuery += ` AND loc.city ILIKE $${params.length + 1}`;
    params.push(`%${filters.city}%`);
  }
  if (filters.province) {
    baseQuery += ` AND loc.province ILIKE $${params.length + 1}`;
    params.push(`%${filters.province}%`);
  }
  if (filters.postalCode) {
    baseQuery += ` AND loc.postalCode ILIKE $${params.length + 1}`;
    params.push(`%${filters.postalCode}%`);
  }

  if (filters.q) {
    baseQuery += ` AND (jp.jobTitle ILIKE $${params.length + 1} OR jp.jobDescription ILIKE $${params.length + 1})`;
    params.push(`%${filters.q}%`);
  }

  if (filters.currentUserId) {
    baseQuery += `
      AND jp.job_id NOT IN (
        SELECT ga.job_id
        FROM gig_applications ga
        JOIN workers w ON ga.worker_profile_id = w.id
        WHERE w.user_id = $${params.length + 1}
          AND ga.status IN ('APPLIED', 'IN_REVIEW', 'ACCEPTED')
      )
    `;
    params.push(filters.currentUserId);
  }

  const countQuery = `
    SELECT COUNT(*)::int AS total
    ${baseQuery};
  `;

  const dataQuery = `
    SELECT
      jp.*,
      loc.StreetAddress,
      loc.city,
      loc.province,
      loc.postalCode,
      COALESCE(bs.business_name, 'Unknown Business') AS business_name
    ${baseQuery}
    ${orderClause}
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2};
  `;

  const countResult = await db.query(countQuery, params);
  const total = countResult.rows[0]?.total ?? 0;

  const dataParams = [...params, limitNum, offsetNum];
  const dataResult = await db.query(dataQuery, dataParams);

  return { jobs: dataResult.rows, total };
};

const applyForJob = async (jobId, applicantId) => {
  const query = `
    UPDATE jobPostings
    SET jobfilled = true, applicant_id = $2
    WHERE job_id = $1
    RETURNING *;
  `;

  try {
    const result = await db.query(query, [jobId, applicantId]);
    return result.rows[0];
  } catch (err) {
    console.error("Error applying for job:", err);
    throw err;
  }
};

const fetchAppliedJobs = async (userId) => {
  try {
    const result = await db.query(
      `
      SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode,
             ga.application_id, ga.status AS application_status, ga.applied_at,
             ga.worker_profile_id,
             w.profile_name,
             COALESCE(bs.business_name, 'Unknown Business') AS business_name
      FROM gig_applications ga
      JOIN workers w ON ga.worker_profile_id = w.id AND w.user_id = $1
      JOIN jobPostings jp ON ga.job_id = jp.job_id
      JOIN locations loc ON jp.location_id = loc.location_id
      LEFT JOIN businesses bs ON jp.user_id = bs.user_id
      `,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching applied jobs:", error);
    throw error;
  }
};

const removeApplication = async (userId, jobId) => {
  try {
    const result = await db.query(
      `
      DELETE FROM gig_applications
      WHERE job_id = $2
        AND worker_profile_id IN (
          SELECT id FROM workers WHERE user_id = $1
        )
        AND status IN ('APPLIED', 'IN_REVIEW', 'ACCEPTED')
      RETURNING *;`,
      [userId, jobId]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error removing job application:", error);
    throw error;
  }
};

// NEW: fetch employer_id (job poster) for a job
const getEmployerIdForJob = async (jobId) => {
  const result = await db.query(
    `SELECT user_id AS employer_id FROM jobPostings WHERE job_id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
};

// NEW: insert into gig_applications when worker applies
const insertGigApplication = async ({ job_id, employer_id, worker_profile_id }) => {
  const result = await db.query(
    `
    INSERT INTO gig_applications (job_id, employer_id, worker_profile_id, status)
    VALUES ($1, $2, $3, 'APPLIED')
    RETURNING application_id, job_id, employer_id, worker_profile_id, status, applied_at, updated_at
    `,
    [job_id, employer_id, worker_profile_id]
  );

  return result.rows[0];
};

const fetchRecommendedJobs = async (userId) => {
  try {
    // This query finds jobs that match keywords in any of the worker's profiles
    // and returns which profiles matched each job.
    const query = `
      WITH worker_data AS (
        SELECT 
          w.id AS profile_id,
          w.profile_name,
          w.desired_pay,
          w.biography,
          -- Postgres regex pattern: "hard worker" -> "hard|worker"
          NULLIF(trim(both '|' from regexp_replace(lower(w.biography), '[^a-z0-9]+', '|', 'g')), '') as bio_regex
        FROM workers w
        WHERE w.user_id = $1
      ),
      scored_matches AS (
        SELECT 
          jp.job_id,
          wd.profile_name,
          (
            -- High weight: Job title matches profile name (case-insensitive ILIKE)
            (CASE WHEN jp.jobtitle ILIKE '%' || wd.profile_name || '%' THEN 10 ELSE 0 END) +
            -- Medium weight: Job description mentions profile name
            (CASE WHEN jp.jobdescription ILIKE '%' || wd.profile_name || '%' THEN 5 ELSE 0 END) +
            -- Pay matches desired pay (or is close)
            (CASE 
              WHEN wd.desired_pay IS NOT NULL AND jp.hourlyRate >= wd.desired_pay THEN 5
              WHEN wd.desired_pay IS NOT NULL AND jp.hourlyRate >= (wd.desired_pay * 0.8) THEN 2
              ELSE 0 
            END) +
            -- Bio keyword matches (using Postgres case-insensitive regex operator ~*)
            (CASE WHEN wd.bio_regex IS NOT NULL AND jp.jobtitle ~* wd.bio_regex THEN 3 ELSE 0 END) +
            (CASE WHEN wd.bio_regex IS NOT NULL AND jp.jobdescription ~* wd.bio_regex THEN 1 ELSE 0 END) +
            (CASE WHEN wd.biography IS NOT NULL AND wd.biography != '' AND jp.jobtitle ILIKE '%' || wd.biography || '%' THEN 5 ELSE 0 END)
          ) AS match_score
        FROM jobPostings jp
        CROSS JOIN worker_data wd
        WHERE jp.jobfilled = false 
          AND jp.status ILIKE 'open'
          -- Exclude jobs you already applied for using efficient NOT EXISTS subquery
          AND NOT EXISTS (
            SELECT 1 FROM gig_applications ga
            JOIN workers w ON ga.worker_profile_id = w.id
            WHERE ga.job_id = jp.job_id 
              AND w.user_id = $1
              AND ga.status IN ('APPLIED', 'IN_REVIEW', 'ACCEPTED')
          )
      )
      SELECT 
        jp.*, 
        loc.StreetAddress, loc.city, loc.province, loc.postalCode,
        COALESCE(bs.business_name, 'Unknown Business') AS business_name,
        string_agg(DISTINCT m.profile_name, ', ') AS recommended_for_profiles,
        MAX(m.match_score) as max_score
      FROM jobPostings jp
      -- Only keep matches that actually scored something directly in the JOIN
      JOIN scored_matches m ON jp.job_id = m.job_id AND m.match_score > 0
      JOIN locations loc ON jp.location_id = loc.location_id
      LEFT JOIN businesses bs ON jp.user_id = bs.user_id
      GROUP BY jp.job_id, loc.location_id, bs.business_name
      ORDER BY max_score DESC, jp.jobStart DESC
      LIMIT 3;
    `;

    const result = await db.query(query, [userId]);
    console.log(`Recommendation query found ${result.rows.length} matches for user ${userId}`);
    return result.rows;
  } catch (err) {
    console.error("Error fetching recommended jobs:", err);
    throw err;
  }
};

module.exports = {
  postJob,
  insertLocation,
  fetchPostedJobsByUserId,
  fetchUnfilledJobsByUserId,
  fetchFilledJobsByUserId,
  fetchJobByJobId,
  updateJob,
  updateJobStatus,
  deleteJobById,
  fetchAllJobs,
  applyForJob,
  fetchAppliedJobs,
  removeApplication,
  getEmployerIdForJob,
  insertGigApplication,
  fetchRecommendedJobs
};