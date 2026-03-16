// backend/src/database/queries/job_queries.js
const db = require("../connection.js");
const { geocodeAddress } = require("../../services/geocodingService");

const buildFullAddress = ({ streetAddress, city, province, postalCode }) => {
  const parts = [streetAddress, city, province, postalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};

const insertLocation = async ({ jobStreetAddress, jobCity, jobProvince, jobPostalCode }) => {
  let latitude = null;
  let longitude = null;

  const fullAddress = buildFullAddress({
    streetAddress: jobStreetAddress,
    city: jobCity,
    province: jobProvince,
    postalCode: jobPostalCode
  });

  try {
    if (fullAddress) {
      const geocoded = await geocodeAddress(fullAddress);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }
    }

    const locationQuery = `
      INSERT INTO locations (
        StreetAddress,
        city,
        province,
        postalCode,
        latitude,
        longitude,
        geocoded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *;
    `;

    const locationResult = await db.query(locationQuery, [
      jobStreetAddress || null,
      jobCity || null,
      jobProvince || null,
      jobPostalCode || null,
      latitude,
      longitude
    ]);

    return locationResult.rows[0];
  } catch (err) {
    console.error("Error inserting location:", err);
    throw err;
  }
};

const postJob = async ({
  jobTitle,
  jobType,
  jobDescription,
  hourlyRate,
  jobStart,
  jobEnd,
  location_id,
  user_id,
  status = "open"
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
      status
    ]);
    return jobResult.rows[0];
  } catch (err) {
    console.error("Error posting job:", err);
    throw err;
  }
};

const fetchPostedJobsByUserId = async (userId) => {
  const query = `
    SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode, loc.latitude, loc.longitude
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
    SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode, loc.latitude, loc.longitude
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
    SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode, loc.latitude, loc.longitude
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    WHERE jp.user_id = $1 AND jp.status = 'completed';
  `;
  try {
    const result = await db.query(query, [userId]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching filled jobs by user ID:", err);
    throw err;
  }
};

const fetchFilledJobsWithWorkers = async (userId) => {
  try {
    const result = await db.query(
      `
      SELECT
        jp.job_id,
        jp.jobtitle,
        jp.jobdescription,
        jp.jobtype,
        jp.hourlyrate,
        jp.jobstart,
        jp.jobend,
        jp.status,
        loc.StreetAddress AS streetaddress,
        loc.city,
        loc.province,
        loc.postalCode    AS postalcode,
        w.first_name      AS worker_first_name,
        w.last_name       AS worker_last_name,
        w.profile_name,
        w.id              AS worker_profile_id,
        u.id              AS worker_user_id
      FROM jobPostings jp
      JOIN locations loc       ON loc.location_id = jp.location_id
      JOIN gig_applications ga ON ga.job_id = jp.job_id AND ga.status = 'ACCEPTED'
      JOIN workers w           ON w.id = ga.worker_profile_id
      JOIN users u             ON u.id = w.user_id
      WHERE jp.user_id = $1
        AND jp.status = 'completed'
      `,
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.error("Error fetching completed jobs with workers:", err);
    throw err;
  }
};

const fetchJobByJobId = async (jobId) => {
  const query = `
    SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode, loc.latitude, loc.longitude
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

const updateJob = async (
  jobId,
  { jobTitle, jobType, jobDescription, hourlyRate, jobStart, jobEnd, locationData, user_id, status }
) => {
  try {
    let latitude = null;
    let longitude = null;

    if (locationData) {
      const fullAddress = buildFullAddress({
        streetAddress: locationData?.streetAddress,
        city: locationData?.city,
        province: locationData?.province,
        postalCode: locationData?.postalCode
      });

      if (fullAddress) {
        const geocoded = await geocodeAddress(fullAddress);
        if (geocoded) {
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
        }
      }
    }

    const locationUpdateQuery = `
      UPDATE locations
      SET StreetAddress = $1, city = $2, province = $3, postalCode = $4, latitude = $5, longitude = $6, geocoded_at = NOW()
      FROM jobPostings
      WHERE locations.location_id = jobPostings.location_id AND jobPostings.job_id = $7;
    `;

    await db.query(locationUpdateQuery, [
      locationData?.streetAddress || null,
      locationData?.city || null,
      locationData?.province || null,
      locationData?.postalCode || null,
      latitude,
      longitude,
      jobId
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
      user_id
    ]);

    return result.rows[0];
  } catch (err) {
    console.error("Error updating job and location:", err);
    throw err;
  }
};

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
    jobPostedDate: "jp.jobposteddate",
    jobStart: "jp.jobStart",
    hourlyRate: "jp.hourlyRate",
    jobId: "jp.job_id",
    distance: "distance_km",
  };

  const rawOriginLat = parseFloat(filters.originLat);
  const rawOriginLon = parseFloat(filters.originLon);
  const rawDistanceKm = parseFloat(filters.distanceKm);

  const useDistanceFilter =
    Number.isFinite(rawOriginLat) &&
    Number.isFinite(rawOriginLon) &&
    Number.isFinite(rawDistanceKm) &&
    rawDistanceKm > 0;

  const distanceSql = useDistanceFilter
    ? `
      (
        6371 * acos(
          LEAST(
            1,
            GREATEST(
              -1,
              cos(radians(${rawOriginLat})) *
              cos(radians(loc.latitude)) *
              cos(radians(loc.longitude) - radians(${rawOriginLon})) +
              sin(radians(${rawOriginLat})) *
              sin(radians(loc.latitude))
            )
          )
        )
      )
    `
    : `NULL`;

  const sortBy = SORT_COLUMNS[filters.sortBy] ? filters.sortBy : "jobPostedDate";
  const sortOrder = String(filters.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const orderClause =
    sortBy === "distance" && useDistanceFilter
      ? `ORDER BY distance_km ${sortOrder}, jp.job_id DESC`
      : `ORDER BY ${SORT_COLUMNS[sortBy]} ${sortOrder}, jp.job_id DESC`;

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
      AND jp.locked = false
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

  if (useDistanceFilter) {
    baseQuery += `
      AND loc.latitude IS NOT NULL
      AND loc.longitude IS NOT NULL
      AND ${distanceSql} <= $${params.length + 1}
    `;
    params.push(rawDistanceKm);
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
      loc.latitude,
      loc.longitude,
      COALESCE(bs.business_name, 'Unknown Business') AS business_name,
      ${
        useDistanceFilter
          ? `ROUND((${distanceSql})::numeric, 2) AS distance_km`
          : `NULL::numeric AS distance_km`
      }
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

const fetchJobLockState = async (jobId) => {
  const result = await db.query(
    `SELECT job_id, locked, jobfilled, status FROM jobPostings WHERE job_id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
};

const setJobLocked = async (jobId, locked) => {
  const result = await db.query(
    `
    UPDATE jobPostings
    SET locked = $2
    WHERE job_id = $1
    RETURNING job_id, locked, status, jobfilled
    `,
    [jobId, locked]
  );
  return result.rows[0] || null;
};

const fetchAppliedJobs = async (userId) => {
  try {
    const result = await db.query(
      `
      SELECT
        jp.*,
        loc.StreetAddress,
        loc.city,
        loc.province,
        loc.postalCode,
        loc.latitude,
        loc.longitude,
        ga.application_id,
        ga.status AS application_status,
        ga.applied_at,
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

const getEmployerIdForJob = async (jobId) => {
  const result = await db.query(
    `SELECT user_id AS employer_id FROM jobPostings WHERE job_id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
};

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

const updateGigApplicationStatus = async (applicationId, status) => {
  const result = await db.query(
    `
    UPDATE gig_applications
    SET status = $2,
        updated_at = now()
    WHERE application_id = $1
    RETURNING application_id, job_id, employer_id, worker_profile_id, status, applied_at, updated_at
    `,
    [applicationId, status]
  );
  return result.rows[0] || null;
};

const rejectOtherApplicationsForJob = async (jobId, acceptedApplicationId) => {
  await db.query(
    `
    UPDATE gig_applications
    SET status = 'REJECTED',
        updated_at = now()
    WHERE job_id = $1
      AND application_id <> $2
      AND status IN ('APPLIED', 'IN_REVIEW')
    `,
    [jobId, acceptedApplicationId]
  );
};

const markJobAsFilled = async (jobId) => {
  await db.query(
    `
    UPDATE jobPostings
    SET jobfilled = true,
        status = 'filled'
    WHERE job_id = $1
    `,
    [jobId]
  );
};

const fetchRecommendedJobs = async (userId) => {
  try {
    const query = `
      WITH worker_data AS (
        SELECT
          w.id AS profile_id,
          w.profile_name,
          w.desired_pay,
          w.biography,
          NULLIF(trim(both '|' from regexp_replace(lower(regexp_replace(lower(w.biography), '\\y[a-z0-9]{1,2}\\y', '', 'g')), '[^a-z0-9]+', '|', 'g')), '') as bio_regex
        FROM workers w
        WHERE w.user_id = $1
      ),
      scored_matches AS (
        SELECT
          jp.job_id,
          wd.profile_name,
          wd.profile_id,
          (
            (CASE WHEN jp.jobtitle ILIKE '%' || wd.profile_name || '%' THEN 20 ELSE 0 END) +
            (CASE WHEN jp.jobdescription ILIKE '%' || wd.profile_name || '%' THEN 10 ELSE 0 END) +
            (CASE WHEN wd.desired_pay IS NOT NULL AND jp.hourlyRate >= wd.desired_pay THEN 2
                  WHEN wd.desired_pay IS NOT NULL AND jp.hourlyRate >= (wd.desired_pay * 0.8) THEN 1 ELSE 0 END) +
            (CASE WHEN wd.bio_regex IS NOT NULL AND jp.jobtitle ~* ('\\\m(' || wd.bio_regex || ')') AND jp.jobdescription ~* ('\\\m(' || wd.bio_regex || ')') THEN 6
                  WHEN wd.bio_regex IS NOT NULL AND (jp.jobtitle ~* ('\\\m(' || wd.bio_regex || ')') OR jp.jobdescription ~* ('\\\m(' || wd.bio_regex || ')')) THEN 2 ELSE 0 END)
          ) AS match_score
        FROM jobPostings jp
        CROSS JOIN worker_data wd
        WHERE jp.jobfilled = false
          AND jp.status ILIKE 'open'
          AND jp.locked = false
          AND NOT EXISTS (
            SELECT 1 FROM gig_applications ga
            JOIN workers w ON ga.worker_profile_id = w.id
            WHERE ga.job_id = jp.job_id
              AND w.user_id = $1
              AND ga.status IN ('APPLIED', 'IN_REVIEW', 'ACCEPTED')
          )
          AND (
            jp.jobtitle ILIKE '%' || wd.profile_name || '%'
            OR jp.jobdescription ILIKE '%' || wd.profile_name || '%'
            OR (wd.bio_regex IS NOT NULL AND jp.jobtitle ~* ('\\\m(' || wd.bio_regex || ')') AND jp.jobdescription ~* ('\\\m(' || wd.bio_regex || ')'))
          )
      ),
      filtered_matches AS (
        SELECT * FROM scored_matches WHERE match_score > 0
      )
      SELECT
        jp.*,
        loc.StreetAddress,
        loc.city,
        loc.province,
        loc.postalCode,
        loc.latitude,
        loc.longitude,
        COALESCE(bs.business_name, 'Unknown Business') AS business_name,
        string_agg(DISTINCT m.profile_name, ', ') AS recommended_for_profiles,
        MAX(m.match_score) as max_score
      FROM jobPostings jp
      JOIN filtered_matches m ON jp.job_id = m.job_id
      JOIN locations loc ON jp.location_id = loc.location_id
      LEFT JOIN businesses bs ON jp.user_id = bs.user_id
      GROUP BY jp.job_id, loc.location_id, bs.business_name
      ORDER BY max_score DESC
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

const fetchApplicantsForJob = async (jobId) => {
  const result = await db.query(
    `
    SELECT
      ga.application_id,
      ga.status         AS application_status,
      ga.applied_at,
      ga.worker_profile_id,
      w.profile_name,
      w.first_name,
      w.last_name,
      u.id              AS user_id,
      u.email,
      u.userimage       AS user_image
    FROM gig_applications ga
    JOIN workers w ON ga.worker_profile_id = w.id
    JOIN users   u ON w.user_id = u.id
    WHERE ga.job_id = $1
    ORDER BY ga.applied_at ASC
    `,
    [jobId]
  );
  return result.rows;
};

module.exports = {
  postJob,
  insertLocation,
  fetchPostedJobsByUserId,
  fetchUnfilledJobsByUserId,
  fetchFilledJobsByUserId,
  fetchFilledJobsWithWorkers,
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
  fetchRecommendedJobs,
  fetchApplicantsForJob,
  updateGigApplicationStatus,
  rejectOtherApplicationsForJob,
  markJobAsFilled,
  fetchJobLockState,
  setJobLocked,
};