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
  status = "open",
  requiredSkills = [],
  requiredExperience = [],
}) => {
  const jobQuery = `
    INSERT INTO jobPostings (
      jobTitle, jobType, jobDescription, hourlyRate, jobStart, jobEnd,
      location_id, user_id, jobfilled, status,
      required_skills, required_experience
    ) VALUES ($1, $2, $3, $4::numeric, $5::timestamp, $6::timestamp, $7, $8, false, $9, $10, $11)
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
      requiredSkills || [],
      requiredExperience || [],
    ]);
    return jobResult.rows[0];
  } catch (err) {
    console.error("Error posting job:", err);
    throw err;
  }
};

const fetchPostedJobsByUserId = async (userId) => {
  const query = `
    SELECT 
      jp.*, 
      loc.StreetAddress, loc.city, loc.province, loc.postalCode, loc.latitude, loc.longitude,
      (SELECT COUNT(*)::int FROM gig_applications ga WHERE ga.job_id = jp.job_id) AS applicant_count
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    WHERE jp.user_id = $1
    ORDER BY jp.job_id DESC;
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
  {
    jobTitle, jobType, jobDescription, hourlyRate, jobStart, jobEnd,
    locationData, user_id, status,
    requiredSkills = [], requiredExperience = [],
  }
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
      SET jobTitle = $1, jobType = $2, jobDescription = $3,
          hourlyRate = $4::numeric, jobStart = $5::timestamp, jobEnd = $6::timestamp,
          status = $7, required_skills = $8, required_experience = $9
      WHERE job_id = $10 AND user_id = $11
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
      requiredSkills || [],
      requiredExperience || [],
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
  const limitNum = Number.isInteger(perPage) && perPage >= 1 && perPage <= 1000 ? perPage : 10;
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

  const sortBy = SORT_COLUMNS[filters.sortBy] ? filters.sortBy : (useDistanceFilter ? "distance" : "jobPostedDate");
  const sortOrder = String(filters.sortOrder || (useDistanceFilter ? "asc" : "desc")).toLowerCase() === "asc" ? "ASC" : "DESC";

  let baseQuery = `
    FROM jobPostings jp
    JOIN locations loc ON jp.location_id = loc.location_id
    LEFT JOIN businesses bs ON jp.user_id = bs.user_id
    WHERE 1=1
  `;

  const params = [];
  let originLatParam = null;
  let originLonParam = null;
  let distanceKmParam = null;

  if (useDistanceFilter) {
    originLatParam = params.length + 1;
    params.push(rawOriginLat);
    originLonParam = params.length + 1;
    params.push(rawOriginLon);
    distanceKmParam = params.length + 1;
    params.push(rawDistanceKm);
  }

  const distanceSql = useDistanceFilter
    ? `
      (
        6371 * acos(
          LEAST(
            1,
            GREATEST(
              -1,
              cos(radians($${originLatParam})) *
              cos(radians(loc.latitude)) *
              cos(radians(loc.longitude) - radians($${originLonParam})) +
              sin(radians($${originLatParam})) *
              sin(radians(loc.latitude))
            )
          )
        )
      )
    `
    : `NULL`;

  const orderClause =
    sortBy === "distance" && useDistanceFilter
      ? `ORDER BY distance_km ${sortOrder}, jp.job_id DESC`
      : `ORDER BY ${SORT_COLUMNS[sortBy]} ${sortOrder}, jp.job_id DESC`;

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

    // After your existing filter conditions, add:
  if (filters.skills && filters.skills.length > 0) {
  baseQuery += ` AND jp.required_skills && $${params.length + 1}::text[]`;
  params.push(filters.skills);
  }

  if (filters.experience && filters.experience.length > 0) {
    baseQuery += ` AND jp.required_experience && $${params.length + 1}::text[]`;
    params.push(filters.experience);
  }

  if (filters.currentUserId) {
    baseQuery += `
      AND jp.job_id NOT IN (
        SELECT ga.job_id
        FROM gig_applications ga
        JOIN workers w ON ga.worker_profile_id = w.id
        WHERE w.user_id = $${params.length + 1}
      )
    `;
    params.push(filters.currentUserId);
  }

  if (useDistanceFilter) {
    baseQuery += `
      AND loc.latitude IS NOT NULL
      AND loc.longitude IS NOT NULL
      AND ${distanceSql} <= $${distanceKmParam}
    `;
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
      (
        SELECT ROUND(AVG(r.rating)::numeric, 2)
        FROM reviews r
        WHERE r.reviewee_id = jp.user_id
      ) AS employer_avg_rating,
      ${
        useDistanceFilter
          ? `ROUND((${distanceSql})::numeric, 2) AS distance_km,
             ROUND(((${distanceSql}) * 0.621371)::numeric, 2) AS distance_miles`
          : `NULL::numeric AS distance_km,
             NULL::numeric AS distance_miles`
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
        COALESCE(bs.business_name, 'Unknown Business') AS business_name,
        jp.user_id AS employer_user_id,
EXISTS (
          SELECT 1 FROM reviews r
          WHERE r.reviewer_id = $1 AND r.reviewee_id = jp.user_id AND r.job_id = jp.job_id
        ) AS has_reviewed_employer,
        (SELECT r.rating FROM reviews r
          WHERE r.reviewer_id = $1 AND r.reviewee_id = jp.user_id AND r.job_id = jp.job_id
          LIMIT 1) AS my_rating_for_employer,
        (SELECT r.rating FROM reviews r
          WHERE r.reviewer_id = jp.user_id AND r.reviewee_id = $1 AND r.job_id = jp.job_id
          LIMIT 1) AS employer_rating_for_me
      FROM gig_applications ga
      JOIN workers w ON ga.worker_profile_id = w.id AND w.user_id = $1
      JOIN jobPostings jp ON ga.job_id = jp.job_id
      JOIN locations loc ON jp.location_id = loc.location_id
      LEFT JOIN businesses bs ON jp.user_id = bs.user_id
      ORDER BY jp.job_id DESC
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
      WITH worker_skill_list AS (
        SELECT DISTINCT lower(s.skill_name) AS val
        FROM workers w
        JOIN workers_skills ws ON w.id = ws.workers_id
        JOIN skills s ON ws.skill_id = s.skill_id
        WHERE w.user_id = $1
      ),
      worker_exp_list AS (
        SELECT DISTINCT lower(e.experience_name) AS val
        FROM workers w
        JOIN workers_experiences we ON w.id = we.workers_id
        JOIN experiences e ON we.experience_id = e.experience_id
        WHERE w.user_id = $1
      ),
      worker_location AS (
        SELECT
          loc.latitude  AS lat,
          loc.longitude AS lng,
          COALESCE(MAX(w.desired_work_radius), 50) AS radius_km
        FROM users u
        LEFT JOIN locations loc ON u.user_address = loc.location_id
        LEFT JOIN workers w ON w.user_id = u.id
        WHERE u.id = $1
        GROUP BY loc.latitude, loc.longitude
      ),
      scored_jobs AS (
        SELECT
          jp.job_id,
          (
            SELECT COUNT(*)
            FROM unnest(COALESCE(jp.required_skills, '{}')) AS rs(v)
            WHERE lower(rs.v) IN (SELECT val FROM worker_skill_list)
          )::int AS matched_skills_count,
          (
            SELECT COUNT(*)
            FROM unnest(COALESCE(jp.required_experience, '{}')) AS re(v)
            WHERE lower(re.v) IN (SELECT val FROM worker_exp_list)
          )::int AS matched_exp_count,
          COALESCE(array_length(jp.required_skills, 1), 0) AS total_required_skills,
          COALESCE(array_length(jp.required_experience, 1), 0) AS total_required_exp,
          (
            SELECT ARRAY_AGG(rs.v)
            FROM unnest(COALESCE(jp.required_skills, '{}')) AS rs(v)
            WHERE lower(rs.v) IN (SELECT val FROM worker_skill_list)
          ) AS matched_skills,
          (
            SELECT ARRAY_AGG(re.v)
            FROM unnest(COALESCE(jp.required_experience, '{}')) AS re(v)
            WHERE lower(re.v) IN (SELECT val FROM worker_exp_list)
          ) AS matched_experiences,
          CASE
            WHEN wl.lat IS NOT NULL AND wl.lng IS NOT NULL
                 AND jl.latitude IS NOT NULL AND jl.longitude IS NOT NULL
            THEN ROUND((6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians(wl.lat)) * cos(radians(jl.latitude)) *
                cos(radians(jl.longitude) - radians(wl.lng)) +
                sin(radians(wl.lat)) * sin(radians(jl.latitude))
              ))
            ))::numeric, 1)
            ELSE NULL
          END AS distance_km
        FROM jobPostings jp
        JOIN locations jl ON jp.location_id = jl.location_id
        CROSS JOIN worker_location wl
        WHERE jp.jobfilled = false
          AND jp.status ILIKE 'open'
          AND jp.locked IS NOT TRUE
          AND (
            COALESCE(array_length(jp.required_skills, 1), 0) > 0
            OR COALESCE(array_length(jp.required_experience, 1), 0) > 0
          )
          AND NOT EXISTS (
            SELECT 1 FROM gig_applications ga
            JOIN workers w ON ga.worker_profile_id = w.id
            WHERE ga.job_id = jp.job_id
              AND w.user_id = $1
              AND ga.status IN ('APPLIED', 'IN_REVIEW', 'ACCEPTED')
          )
      ),
      filtered_jobs AS (
        SELECT *,
          (matched_skills_count + matched_exp_count) AS match_score
        FROM scored_jobs
        WHERE (matched_skills_count + matched_exp_count) > 0
          AND (
            distance_km IS NULL
            OR distance_km <= (SELECT radius_km FROM worker_location)
          )
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
        fj.matched_skills,
        fj.matched_experiences,
        fj.matched_skills_count,
        fj.matched_exp_count,
        fj.total_required_skills,
        fj.total_required_exp,
        fj.match_score,
        fj.distance_km
      FROM filtered_jobs fj
      JOIN jobPostings jp ON fj.job_id = jp.job_id
      JOIN locations loc ON jp.location_id = loc.location_id
      LEFT JOIN businesses bs ON jp.user_id = bs.user_id
      ORDER BY fj.match_score DESC, fj.distance_km ASC NULLS LAST, jp.jobposteddate DESC
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
      u.userimage       AS user_image,
EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.reviewer_id = jp.user_id AND r.reviewee_id = u.id AND r.job_id = $1
    ) AS has_reviewed_worker,
    (SELECT r.rating FROM reviews r
      WHERE r.reviewer_id = jp.user_id AND r.reviewee_id = u.id AND r.job_id = $1
      LIMIT 1) AS my_rating_for_worker,
    (SELECT r.rating FROM reviews r
      WHERE r.reviewer_id = u.id AND r.reviewee_id = jp.user_id AND r.job_id = $1
      LIMIT 1) AS worker_rating_for_me
    FROM gig_applications ga
    JOIN workers w      ON ga.worker_profile_id = w.id
    JOIN users   u      ON w.user_id = u.id
    JOIN jobPostings jp ON jp.job_id = ga.job_id
    WHERE ga.job_id = $1
    ORDER BY ga.applied_at ASC
    `,
    [jobId]
  );
  return result.rows;
};

const acceptInReviewApplicants = async (jobId) => {
  const result = await db.query(
    `
    UPDATE gig_applications
    SET status = 'ACCEPTED', updated_at = now()
    WHERE job_id = $1 AND status IN ('IN_REVIEW', 'APPLIED')
    RETURNING *;
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
  acceptInReviewApplicants,
};
