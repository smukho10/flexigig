const db = require("../connection.js");
const { geocodeAddress } = require("../../services/geocodingService");

const buildFullAddress = ({ streetAddress, city, province, postalCode }) => {
  return [streetAddress, city, province, postalCode].filter(Boolean).join(", ");
};

const checkWorkerProfile = async (userId) => {
  try {
    const userProfile = await db.query(
      `SELECT id FROM workers WHERE user_id = $1;`,
      [userId]
    );
    return userProfile.rows[0];
  } catch (error) {
    console.error("Error fetching user by ID: ", error);
    throw error;
  }
};

const checkBusinessProfile = async (userId) => {
  try {
    const userProfile = await db.query(
      `SELECT id FROM businesses WHERE user_id = $1;`,
      [userId]
    );
    return userProfile.rows[0];
  } catch (error) {
    console.error("Error fetching user by ID: ", error);
    throw error;
  }
};

const addUserProfile = (userId, worker) => {
  const query = `
    INSERT INTO workers (
      user_id,
      biography,
      worker_phone_number,
      worker_street_address,
      worker_city,
      worker_province,
      worker_postal_code,
      desired_work_radius,
      skills,
      desired_pay
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  return db
    .query(query, [
      userId,
      worker.biography,
      worker.phone_number,
      worker.street_address,
      worker.city,
      worker.province,
      worker.postal_code,
      worker.desired_work_radius,
      worker.skills,
      worker.desired_pay,
    ])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error adding user profile:", err);
    });
};

const getBusinessProfile = (user_id) => {
  const query = `
    SELECT
      users.id,
      users.email,
      users.active,
      users.signUpDate,
      users.user_phone_number AS phone_number,
      businesses.business_name,
      businesses.business_description,
      businesses.business_website,
      locations.streetaddress AS street_address,
      locations.city,
      locations.province,
      locations.postalcode AS postal_code,
      locations.latitude,
      locations.longitude
    FROM users
    JOIN businesses ON users.id = businesses.user_id
    JOIN locations ON users.user_address = locations.location_id
    WHERE users.id = $1;
  `;

  return db
    .query(query, [user_id])
    .then((result) => {
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      return null;
    })
    .catch((err) => {
      console.error("Error checking business profile:", err);
    });
};

const addBusinessProfile = (userId, business) => {
  const query = `
    INSERT INTO businesses (
      user_id,
      business_name,
      business_description,
      business_phone_number,
      business_email,
      business_street_address,
      business_city,
      business_province,
      business_postal_code,
      business_website
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  return db
    .query(query, [
      userId,
      business.name,
      business.description,
      business.phone_number,
      business.email,
      business.street_address,
      business.city,
      business.province,
      business.postal_code,
      business.website,
    ])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error adding user profile:", err);
    });
};

const updateBusinessProfile = (business) => {
  const query = `
    UPDATE businesses
    SET
      business_name = $1,
      business_description = $2,
      business_phone_number = $3,
      business_email = $4,
      business_street_address = $5,
      business_city = $6,
      business_province = $7,
      business_postal_code = $8,
      business_website = $9
    WHERE id = $10
    RETURNING *;
  `;

  return db
    .query(query, [
      business.name,
      business.description,
      business.phone_number,
      business.email,
      business.street_address,
      business.city,
      business.province,
      business.postal_code,
      business.website,
      business.id,
    ])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error updating profile: ", err);
    });
};

const updateUserProfile = async (userId, worker) => {
  try {
    const updatedWorker = await db.query(
      `UPDATE workers
       SET biography = $2,
           worker_phone_number = $3,
           worker_street_address = $4,
           worker_city = $5,
           worker_province = $6,
           worker_postal_code = $7,
           desired_work_radius = $8,
           skills = $9,
           desired_pay = $10
       WHERE user_id = $1
       RETURNING *;`,
      [
        userId,
        worker.biography,
        worker.phone_number,
        worker.street_address,
        worker.city,
        worker.province,
        worker.postal_code,
        worker.desired_work_radius,
        worker.skills,
        worker.desired_pay,
      ]
    );

    await db.query(
      `UPDATE users
       SET firstname = $2,
           lastname = $3
       WHERE id = $1
       RETURNING *;`,
      [userId, worker.firstname, worker.lastname]
    );

    return updatedWorker.rows[0];
  } catch (error) {
    console.error("Error updating profile: ", error);
    throw error;
  }
};

const updateWorkerProfileById = async (workerId, worker) => {
  try {
    const updatedWorker = await db.query(
      `UPDATE workers
       SET biography = $2,
           first_name = $3,
           last_name = $4,
           profile_name = $5,
           desired_work_radius = $6,
           desired_pay = $7
       WHERE id = $1
       RETURNING *;`,
      [
        workerId,
        worker.biography,
        worker.firstname,
        worker.lastname,
        worker.profile_name,
        worker.desired_work_radius,
        worker.desired_pay,
      ]
    );

    if (
      worker.phone_number ||
      worker.street_address ||
      worker.city ||
      worker.province ||
      worker.postal_code
    ) {
      const workerData = await db.query(
        `SELECT user_id FROM workers WHERE id = $1;`,
        [workerId]
      );

      if (workerData.rows.length > 0) {
        const userId = workerData.rows[0].user_id;

        if (worker.phone_number) {
          await db.query(`UPDATE users SET user_phone_number = $1 WHERE id = $2;`, [
            worker.phone_number,
            userId,
          ]);
        }

        if (
          worker.street_address ||
          worker.city ||
          worker.province ||
          worker.postal_code
        ) {
          const userData = await db.query(
            `SELECT user_address FROM users WHERE id = $1;`,
            [userId]
          );

          if (userData.rows.length > 0 && userData.rows[0].user_address) {
            const locationId = userData.rows[0].user_address;

            const currentLocationResult = await db.query(
              `SELECT streetaddress, city, province, postalcode
               FROM locations
               WHERE location_id = $1;`,
              [locationId]
            );

            const currentLocation = currentLocationResult.rows[0];

            const nextStreetAddress =
              worker.street_address ?? currentLocation?.streetaddress ?? null;
            const nextCity = worker.city ?? currentLocation?.city ?? null;
            const nextProvince =
              worker.province ?? currentLocation?.province ?? null;
            const nextPostalCode =
              worker.postal_code ?? currentLocation?.postalcode ?? null;

            const fullAddress = buildFullAddress({
              streetAddress: nextStreetAddress,
              city: nextCity,
              province: nextProvince,
              postalCode: nextPostalCode,
            });

            let latitude = null;
            let longitude = null;

            if (fullAddress) {
              const geocoded = await geocodeAddress(fullAddress);
              if (geocoded) {
                latitude = geocoded.latitude;
                longitude = geocoded.longitude;
              }
            }

            await db.query(
              `UPDATE locations
               SET streetaddress = $1,
                   city = $2,
                   province = $3,
                   postalcode = $4,
                   latitude = $5,
                   longitude = $6,
                   geocoded_at = NOW()
               WHERE location_id = $7;`,
              [
                nextStreetAddress,
                nextCity,
                nextProvince,
                nextPostalCode,
                latitude,
                longitude,
                locationId,
              ]
            );
          }
        }
      }
    }

    return updatedWorker.rows[0];
  } catch (error) {
    console.error("Error updating worker profile by ID:", error);
    throw error;
  }
};

const getProfile = (userId) => {
  const query = `
    SELECT
      users.id,
      users.email,
      users.active,
      users.signUpDate,
      users.user_phone_number AS phone_number,
      workers.first_name AS firstname,
      workers.last_name AS lastname,
      workers.biography,
      workers.desired_work_radius,
      workers.desired_pay,
      locations.streetaddress AS street_address,
      locations.city,
      locations.province,
      locations.postalcode AS postal_code,
      locations.latitude,
      locations.longitude
    FROM users
    JOIN workers ON users.id = workers.user_id
    JOIN locations ON users.user_address = locations.location_id
    WHERE users.id = $1;
  `;

  return db
    .query(query, [userId])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error retrieving user profile information: ", err);
    });
};

const listWorkerProfiles = async (userId) => {
  const q = `
    SELECT id, user_id, profile_name, first_name, last_name
    FROM workers
    WHERE user_id = $1
    ORDER BY id ASC;
  `;
  const result = await db.query(q, [userId]);
  return result.rows;
};

const getProfileByWorkerId = (workerId) => {
  const query = `
    SELECT
      users.id,
      users.email,
      users.active,
      users.signUpDate,
      users.user_phone_number AS phone_number,
      workers.id AS worker_id,
      workers.profile_name,
      workers.first_name AS firstname,
      workers.last_name AS lastname,
      workers.biography,
      workers.desired_work_radius,
      workers.desired_pay,
      locations.streetaddress AS street_address,
      locations.city,
      locations.province,
      locations.postalcode AS postal_code,
      locations.latitude,
      locations.longitude
    FROM users
    JOIN workers ON users.id = workers.user_id
    JOIN locations ON users.user_address = locations.location_id
    WHERE workers.id = $1;
  `;

  return db.query(query, [workerId]).then((r) => r.rows[0]);
};

const createWorkerProfile = async (userId, profileName) => {
  const base = await db.query(
    `SELECT first_name, last_name FROM workers WHERE user_id = $1 ORDER BY id ASC LIMIT 1;`,
    [userId]
  );

  if (base.rows.length === 0) return null;

  const firstName = base.rows[0].first_name;
  const lastName = base.rows[0].last_name;

  const ins = await db.query(
    `INSERT INTO workers (user_id, profile_name, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, profile_name, first_name, last_name;`,
    [userId, profileName, firstName, lastName]
  );

  return ins.rows[0];
};

const deleteWorkerProfile = async (workerId) => {
  try {
    await db.query(`DELETE FROM workers_skills WHERE workers_id = $1;`, [workerId]);
    await db.query(`DELETE FROM workers_traits WHERE workers_id = $1;`, [workerId]);
    await db.query(`DELETE FROM workers_experiences WHERE workers_id = $1;`, [workerId]);

    const result = await db.query(
      `DELETE FROM workers WHERE id = $1 RETURNING *;`,
      [workerId]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error deleting worker profile:", error);
    throw error;
  }
};

module.exports = {
  checkWorkerProfile,
  addUserProfile,
  updateUserProfile,
  updateWorkerProfileById,
  getProfile,
  checkBusinessProfile,
  addBusinessProfile,
  getBusinessProfile,
  listWorkerProfiles,
  getProfileByWorkerId,
  createWorkerProfile,
  deleteWorkerProfile,
  updateBusinessProfile,
};