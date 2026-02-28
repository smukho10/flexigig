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

  // Sorting whitelist
  const SORT_COLUMNS = {
    jobStart: "jp.jobStart",
    hourlyRate: "jp.hourlyRate",
    jobId: "jp.job_id",
  };

  const sortBy = SORT_COLUMNS[filters.sortBy] ? filters.sortBy : "jobStart";
  const sortOrder = String(filters.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const orderClause = `ORDER BY ${SORT_COLUMNS[sortBy]} ${sortOrder}, jp.job_id DESC`;

  // Base query
  let baseQuery = `
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    LEFT JOIN businesses bs ON jp.user_id = bs.user_id
    WHERE 1=1
  `;

  const params = [];

  // Default behavior: show gigs that are NOT filled and NOT in draft/filled/completed-ish statuses
  // If status filter is supplied, we respect it (and relax defaults as needed).
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
    // If user explicitly asks for statuses including filled/completed, do NOT force jobfilled=false
    if (!statusIncludesFilledLike) {
      baseQuery += ` AND jp.jobfilled = false`;
    }
    baseQuery += ` AND jp.status = ANY($${params.length + 1})`;
    params.push(statusList);
  }

  // jobType
  if (filters.jobType) {
    baseQuery += ` AND jp.jobType = $${params.length + 1}`;
    params.push(filters.jobType);
  }

  // Optional poster filter
  if (filters.userId) {
    baseQuery += ` AND jp.user_id = $${params.length + 1}`;
    params.push(filters.userId);
  }

  // Hourly rate range
  if (filters.hourlyRateMin != null) {
    baseQuery += ` AND jp.hourlyRate >= $${params.length + 1}::numeric`;
    params.push(filters.hourlyRateMin);
  }
  if (filters.hourlyRateMax != null) {
    baseQuery += ` AND jp.hourlyRate <= $${params.length + 1}::numeric`;
    params.push(filters.hourlyRateMax);
  }

  // Date range (jobStart)
  if (filters.startFrom) {
    baseQuery += ` AND jp.jobStart >= $${params.length + 1}::timestamp`;
    params.push(filters.startFrom);
  }
  if (filters.startTo) {
    baseQuery += ` AND jp.jobStart <= $${params.length + 1}::timestamp`;
    params.push(filters.startTo);
  }

  // Date range (jobEnd)
  if (filters.endFrom) {
    baseQuery += ` AND jp.jobEnd >= $${params.length + 1}::timestamp`;
    params.push(filters.endFrom);
  }
  if (filters.endTo) {
    baseQuery += ` AND jp.jobEnd <= $${params.length + 1}::timestamp`;
    params.push(filters.endTo);
  }

  // Location filters (ILIKE)
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

  // Keyword search (title/description)
  if (filters.q) {
    baseQuery += ` AND (jp.jobTitle ILIKE $${params.length + 1} OR jp.jobDescription ILIKE $${params.length + 1})`;
    params.push(`%${filters.q}%`);
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
};