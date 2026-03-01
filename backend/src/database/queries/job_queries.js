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

/**
 * Paginated "all jobs" query.
 * Supports BOTH call styles:
 * 1) fetchAllJobs(filters)
 * 2) fetchAllJobs({ filters, page, perPage })
 *
 * Returns: { jobs, total }
 */
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

  let baseQuery = `
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    LEFT JOIN businesses bs ON jp.user_id = bs.user_id
    WHERE jp.jobfilled = false
    AND jp.status NOT IN ('draft', 'filled', 'complete', 'completed')
  `;

  const params = [];

  if (filters.jobType) {
    baseQuery += ` AND jp.jobType = $${params.length + 1}`;
    params.push(filters.jobType);
  }

  if (filters.hourlyRate) {
    const [minRateRaw, maxRateRaw] = String(filters.hourlyRate).split("-");
    const minRate = minRateRaw;
    const maxRate = maxRateRaw ? maxRateRaw : minRateRaw;

    baseQuery += ` AND jp.hourlyRate BETWEEN $${params.length + 1} AND $${
      params.length + 2
    }`;
    params.push(minRate, maxRate);
  }

  if (filters.startDate) {
    baseQuery += ` AND date_trunc('minute', jp.jobStart) = date_trunc('minute', $${params.length + 1}::timestamp)`;
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    baseQuery += ` AND date_trunc('minute', jp.jobEnd) = date_trunc('minute', $${params.length + 1}::timestamp)`;
    params.push(filters.endDate);
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
    ORDER BY jp.jobposteddate DESC
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

const fetchAppliedJobs = async (applicantId) => {
  try {
    const result = await db.query(
      `
      SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode,
             COALESCE(bs.business_name, 'Unknown Business') AS business_name
      FROM jobPostings jp
      JOIN locations loc ON jp.location_id = loc.location_id
      LEFT JOIN businesses bs ON jp.user_id = bs.user_id
      WHERE jp.applicant_id = $1`,
      [applicantId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching applied jobs:", error);
    throw error;
  }
};

const removeApplication = async (applicantId, jobId) => {
  try {
    const result = await db.query(
      `
      UPDATE jobpostings
      SET jobfilled = false, applicant_id = NULL
      WHERE applicant_id = $1 AND job_id = $2
      RETURNING *;`,
      [applicantId, jobId]
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
  insertGigApplication
};