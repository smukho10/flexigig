// backend/src/database/queries/job_queries.js
const db = require("../connection.js");
const https = require("https");

const NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  "FlexyGig/1.0 (contact: admin@flexygig.local)";
const GEOCODE_COUNTRY = process.env.GEOCODE_COUNTRY || "Canada";
const GEOCODE_COUNTRY_CODE = (
  process.env.GEOCODE_COUNTRY_CODE || "ca"
).toLowerCase();
const GEOCODE_THROTTLE_MS = Number(process.env.GEOCODE_THROTTLE_MS || 1500);
const GEOCODE_RETRY_MS = Number(process.env.GEOCODE_RETRY_MS || 5000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let geocodeQueue = Promise.resolve();

const enqueueGeocode = async (task) => {
  const run = geocodeQueue.then(task, task);
  geocodeQueue = run.catch(() => null);
  return run;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeAddress = ({
  streetAddress,
  city,
  province,
  postalCode,
  country,
}) => {
  const parts = [
    normalizeText(streetAddress),
    normalizeText(city),
    normalizeText(province),
    normalizeText(postalCode),
    normalizeText(country),
  ].filter(Boolean);

  return parts.join(", ");
};

const buildLocationGeocodeInput = (locationRow) => ({
  streetAddress: normalizeText(
    locationRow.streetaddress || locationRow.StreetAddress
  ),
  city: normalizeText(locationRow.city),
  province: normalizeText(locationRow.province),
  postalCode: normalizeText(locationRow.postalcode || locationRow.postalCode),
  country: normalizeText(GEOCODE_COUNTRY || "Canada"),
  countryCode: normalizeText(GEOCODE_COUNTRY_CODE || "ca").toLowerCase(),
});

const buildLocationAddress = (locationRow) =>
  normalizeAddress(buildLocationGeocodeInput(locationRow));

const httpsGetJson = (url, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": NOMINATIM_USER_AGENT,
          Accept: "application/json",
          ...headers,
        },
      },
      (res) => {
        let raw = "";

        res.on("data", (chunk) => {
          raw += chunk;
        });

        res.on("end", () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(
                new Error(`Geocoding failed with status ${res.statusCode}: ${raw}`)
              );
            }

            const parsed = JSON.parse(raw);
            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("error", reject);
    req.end();
  });

const buildGeocodeUrl = (input) => {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
  });

  if (input && typeof input === "object") {
    const streetAddress = normalizeText(input.streetAddress);
    const city = normalizeText(input.city);
    const province = normalizeText(input.province);
    const postalCode = normalizeText(input.postalCode);
    const country = normalizeText(input.country || GEOCODE_COUNTRY);
    const countryCode = normalizeText(
      input.countryCode || GEOCODE_COUNTRY_CODE
    ).toLowerCase();

    if (countryCode) {
      params.set("countrycodes", countryCode);
    }

    const hasStructuredFields =
      streetAddress || city || province || postalCode || country;

    if (hasStructuredFields) {
      if (streetAddress) params.set("street", streetAddress);
      if (city) params.set("city", city);
      if (province) params.set("state", province);
      if (postalCode) params.set("postalcode", postalCode);
      if (country) params.set("country", country);
    } else {
      const q = normalizeAddress({
        streetAddress,
        city,
        province,
        postalCode,
        country,
      });

      if (q) {
        params.set("q", q);
      }
    }
  } else {
    const q = normalizeText(input);

    if (GEOCODE_COUNTRY_CODE) {
      params.set("countrycodes", GEOCODE_COUNTRY_CODE.toLowerCase());
    }

    if (q) {
      params.set("q", q);
    }
  }

  return `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
};

const geocodeAddress = async (input, hasRetried = false) => {
  const hasObjectInput = input && typeof input === "object";
  const asText = hasObjectInput
    ? normalizeAddress(input)
    : normalizeText(input);

  if (!asText) return null;

  return enqueueGeocode(async () => {
    await sleep(GEOCODE_THROTTLE_MS);

    const url = buildGeocodeUrl(input);

    try {
      const data = await httpsGetJson(url);

      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      const first = data[0];
      const latitude = toNumberOrNull(first.lat);
      const longitude = toNumberOrNull(first.lon);

      if (latitude === null || longitude === null) {
        return null;
      }

      return {
        latitude,
        longitude,
        displayName: first.display_name || null,
      };
    } catch (err) {
      const message = String(err.message || "");

      if (!hasRetried && message.includes("status 429")) {
        console.warn("Nominatim rate limit hit. Retrying once after backoff...");
        await sleep(GEOCODE_RETRY_MS);
        return geocodeAddress(input, true);
      }

      throw err;
    }
  });
};

const haversineDistanceMiles = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.8;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getLocationById = async (locationId) => {
  const result = await db.query(
    `
    SELECT location_id, StreetAddress, city, province, postalCode, latitude, longitude, geocoded_at
    FROM locations
    WHERE location_id = $1
    `,
    [locationId]
  );
  return result.rows[0] || null;
};

const updateLocationCoordinates = async (locationId, latitude, longitude) => {
  const result = await db.query(
    `
    UPDATE locations
    SET latitude = $2,
        longitude = $3,
        geocoded_at = NOW()
    WHERE location_id = $1
    RETURNING location_id, latitude, longitude, geocoded_at
    `,
    [locationId, latitude, longitude]
  );
  return result.rows[0] || null;
};

const clearLocationCoordinates = async (locationId) => {
  const result = await db.query(
    `
    UPDATE locations
    SET latitude = NULL,
        longitude = NULL,
        geocoded_at = NULL
    WHERE location_id = $1
    RETURNING location_id, latitude, longitude, geocoded_at
    `,
    [locationId]
  );
  return result.rows[0] || null;
};

const updateLocationAddress = async (
  locationId,
  { streetAddress, city, province, postalCode }
) => {
  const result = await db.query(
    `
    UPDATE locations
    SET StreetAddress = $2,
        city = $3,
        province = $4,
        postalCode = $5,
        latitude = NULL,
        longitude = NULL,
        geocoded_at = NULL
    WHERE location_id = $1
    RETURNING location_id, StreetAddress, city, province, postalCode, latitude, longitude, geocoded_at
    `,
    [
      locationId,
      streetAddress || null,
      city || null,
      province || null,
      postalCode || null,
    ]
  );

  return result.rows[0] || null;
};

const refreshLocationCoordinates = async (locationId) => {
  await clearLocationCoordinates(locationId);
  return ensureLocationCoordinates(locationId);
};

const updateLocationAddressAndGeocode = async (
  locationId,
  { streetAddress, city, province, postalCode }
) => {
  const updatedLocation = await updateLocationAddress(locationId, {
    streetAddress,
    city,
    province,
    postalCode,
  });

  if (!updatedLocation) return null;

  await ensureLocationCoordinates(locationId);
  return getLocationById(locationId);
};

const getStoredLocationCoordinates = async (locationId) => {
  if (!locationId) return null;

  const location = await getLocationById(locationId);
  if (!location) return null;

  const existingLat = toNumberOrNull(location.latitude);
  const existingLon = toNumberOrNull(location.longitude);

  if (existingLat === null || existingLon === null) {
    return null;
  }

  return {
    latitude: existingLat,
    longitude: existingLon,
    source: "db",
  };
};

const ensureLocationCoordinates = async (locationId) => {
  if (!locationId) return null;

  const location = await getLocationById(locationId);
  if (!location) return null;

  const existingLat = toNumberOrNull(location.latitude);
  const existingLon = toNumberOrNull(location.longitude);

  if (existingLat !== null && existingLon !== null) {
    return {
      latitude: existingLat,
      longitude: existingLon,
      source: "db",
    };
  }

  const geocodeInput = buildLocationGeocodeInput(location);
  const fullAddress = buildLocationAddress(location);

  if (!fullAddress) return null;

  const geocoded = await geocodeAddress(geocodeInput);
  if (!geocoded) return null;

  await updateLocationCoordinates(
    location.location_id,
    geocoded.latitude,
    geocoded.longitude
  );

  return {
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    source: "nominatim",
  };
};

const geocodeAndStoreLocationIfPossible = async (locationId) => {
  try {
    return await ensureLocationCoordinates(locationId);
  } catch (err) {
    console.error("Geocoding failed for location:", locationId, err.message);
    return null;
  }
};

const getUserLocationCoordinates = async (userId) => {
  const result = await db.query(
    `
    SELECT
      u.id AS user_id,
      u.user_address AS location_id,
      l.StreetAddress,
      l.city,
      l.province,
      l.postalCode,
      l.latitude,
      l.longitude
    FROM users u
    JOIN locations l ON u.user_address = l.location_id
    WHERE u.id = $1
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row || !row.location_id) return null;

  return ensureLocationCoordinates(row.location_id);
};

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

    const location = locationResult.rows[0];

    await geocodeAndStoreLocationIfPossible(location.location_id);

    return await getLocationById(location.location_id);
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
    const locationIdResult = await db.query(
      `
      SELECT location_id
      FROM jobPostings
      WHERE job_id = $1
      `,
      [jobId]
    );

    const locationId = locationIdResult.rows[0]?.location_id || null;

    if (locationId) {
      await updateLocationAddressAndGeocode(locationId, {
        streetAddress: locationData?.streetAddress || null,
        city: locationData?.city || null,
        province: locationData?.province || null,
        postalCode: locationData?.postalCode || null,
      });
    }

    const jobUpdateQuery = `
      UPDATE jobPostings
      SET jobTitle = $1,
          jobType = $2,
          jobDescription = $3,
          hourlyRate = $4::numeric,
          jobStart = $5::timestamp,
          jobEnd = $6::timestamp,
          status = $7
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

const attachDistanceAndFilterJobs = async (
  jobs,
  currentUserId,
  distanceMiles
) => {
  const numericDistanceMiles = Number(distanceMiles);

  if (
    !currentUserId ||
    !Number.isFinite(numericDistanceMiles) ||
    numericDistanceMiles <= 0
  ) {
    return jobs;
  }

  const workerCoords = await getUserLocationCoordinates(currentUserId);

  if (!workerCoords) {
    const err = new Error(
      "Worker address is missing or could not be geocoded. Please update your profile address."
    );
    err.statusCode = 400;
    throw err;
  }

  const filteredJobs = [];

  for (const job of jobs) {
    try {
      const existingLat = toNumberOrNull(job.latitude);
      const existingLon = toNumberOrNull(job.longitude);

      let jobCoords = null;

      if (existingLat !== null && existingLon !== null) {
        jobCoords = {
          latitude: existingLat,
          longitude: existingLon,
          source: "query",
        };
      } else if (job.location_id) {
        jobCoords = await getStoredLocationCoordinates(job.location_id);
      }

      if (!jobCoords) {
        continue;
      }

      const distance = haversineDistanceMiles(
        workerCoords.latitude,
        workerCoords.longitude,
        jobCoords.latitude,
        jobCoords.longitude
      );

      if (distance <= numericDistanceMiles) {
        filteredJobs.push({
          ...job,
          latitude: jobCoords.latitude,
          longitude: jobCoords.longitude,
          distanceMiles: Number(distance.toFixed(2)),
        });
      }
    } catch (err) {
      console.error(
        `Skipping distance calculation for job ${job.job_id}:`,
        err.message
      );
    }
  }

  filteredJobs.sort((a, b) => {
    const da = Number.isFinite(a.distanceMiles)
      ? a.distanceMiles
      : Number.POSITIVE_INFINITY;
    const dbv = Number.isFinite(b.distanceMiles)
      ? b.distanceMiles
      : Number.POSITIVE_INFINITY;
    return da - dbv;
  });

  return filteredJobs;
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
  };

  const sortBy =
    SORT_COLUMNS[filters.sortBy] ? filters.sortBy : "jobPostedDate";
  const sortOrder =
    String(filters.sortOrder || "desc").toLowerCase() === "asc"
      ? "ASC"
      : "DESC";
  const orderClause = `ORDER BY ${SORT_COLUMNS[sortBy]} ${sortOrder}, jp.job_id DESC`;

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
      : typeof filters.status === "string" && filters.status.trim()
      ? filters.status.split(",").map((s) => s.trim()).filter(Boolean)
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

  const distanceMiles =
    filters.distanceMiles != null && filters.distanceMiles !== ""
      ? Number(filters.distanceMiles)
      : null;

  const shouldApplyDistanceFilter =
    Number.isFinite(distanceMiles) && distanceMiles > 0 && filters.currentUserId;

  if (shouldApplyDistanceFilter) {
    const dataQueryNoPagination = `
      SELECT
        jp.*,
        loc.location_id,
        loc.StreetAddress,
        loc.city,
        loc.province,
        loc.postalCode,
        loc.latitude,
        loc.longitude,
        COALESCE(bs.business_name, 'Unknown Business') AS business_name
      ${baseQuery}
      ${orderClause};
    `;

    const rawResult = await db.query(dataQueryNoPagination, params);
    const jobsWithDistance = await attachDistanceAndFilterJobs(
      rawResult.rows,
      filters.currentUserId,
      distanceMiles
    );

    const total = jobsWithDistance.length;
    const paginatedJobs = jobsWithDistance.slice(offsetNum, offsetNum + limitNum);

    return { jobs: paginatedJobs, total };
  }

  const countQuery = `
    SELECT COUNT(*)::int AS total
    ${baseQuery};
  `;

  const dataQuery = `
    SELECT
      jp.*,
      loc.location_id,
      loc.StreetAddress,
      loc.city,
      loc.province,
      loc.postalCode,
      loc.latitude,
      loc.longitude,
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
      SELECT jp.*, loc.StreetAddress, loc.city, loc.province, loc.postalCode,
             loc.latitude, loc.longitude,
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

const getEmployerIdForJob = async (jobId) => {
  const result = await db.query(
    `SELECT user_id AS employer_id FROM jobPostings WHERE job_id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
};

const insertGigApplication = async ({
  job_id,
  employer_id,
  worker_profile_id,
}) => {
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
            (CASE WHEN wd.bio_regex IS NOT NULL AND jp.jobtitle ~* ('\\m(' || wd.bio_regex || ')') AND jp.jobdescription ~* ('\\m(' || wd.bio_regex || ')') THEN 6
                  WHEN wd.bio_regex IS NOT NULL AND (jp.jobtitle ~* ('\\m(' || wd.bio_regex || ')') OR jp.jobdescription ~* ('\\m(' || wd.bio_regex || ')')) THEN 2 ELSE 0 END)
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
            OR (wd.bio_regex IS NOT NULL AND jp.jobtitle ~* ('\\m(' || wd.bio_regex || ')') AND jp.jobdescription ~* ('\\m(' || wd.bio_regex || ')'))
          )
      ),
      filtered_matches AS (
        SELECT * FROM scored_matches WHERE match_score > 0
      )
      SELECT
        jp.*,
        loc.StreetAddress, loc.city, loc.province, loc.postalCode, loc.latitude, loc.longitude,
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
    console.log(
      `Recommendation query found ${result.rows.length} matches for user ${userId}`
    );
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
  getUserLocationCoordinates,
  getStoredLocationCoordinates,
  ensureLocationCoordinates,
  geocodeAddress,
  haversineDistanceMiles,
};