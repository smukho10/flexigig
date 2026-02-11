const db = require('../connection.js');

const checkWorkerProfile = async (userId) => {
  try {
    const userProfile = await db.query(`SELECT id FROM workers WHERE user_id = $1;`, [userId]);
    return userProfile.rows[0]; // Assuming userId is unique, so returning the first row
  } catch (error) {
    console.error("Error fetching user by ID: ", error);
    throw error;
  }
};

const checkBusinessProfile = async (userId) => {
  try {
    const userProfile = await db.query(`SELECT id FROM businesses WHERE user_id = $1;`, [userId]);
    return userProfile.rows[0]; // Assuming userId is unique, so returning the first row
  } catch (error) {
    console.error("Error fetching user by ID: ", error);
    throw error;
  }
};

const addUserProfile = (userId, worker) => {

  const query = `INSERT INTO workers (user_id, biography, worker_phone_number, worker_street_address, worker_city, worker_province, worker_postal_code, desired_work_radius, skills, desired_pay) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;`;

  return db
    .query(query, [userId, worker.biography, worker.phone_number, worker.street_address, worker.city, worker.province, worker.postal_code, worker.desired_work_radius, worker.skills, worker.desired_pay])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error adding user profile:", err);
    });
};

const getBusinessProfile = (user_id) => {
  //const query = `SELECT * FROM businesses where user_id = $1`;
  const query = `SELECT users.id,
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
  locations.postalcode AS postal_code
FROM users
JOIN businesses ON users.id = businesses.user_id
JOIN locations ON users.user_address = locations.location_id
WHERE users.id = $1;`;

  return db.query(query, [user_id])
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

  const query = `INSERT INTO businesses (user_id, business_name, business_description, business_phone_number, business_email, business_street_address, business_city, business_province, business_postal_code, business_website) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;`;

  return db
    .query(query, [userId, business.name, business.description, business.phone_number, business.email, business.street_address, business.city, business.province, business.postal_code, business.website])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error adding user profile:", err);
    });
};

const updateBusinessProfile = (business) => {

  const query = `UPDATE businesses SET
    business_name = $1,
    business_description = $2,
    business_phone_number = $3,
    business_email = $4,
    business_street_address = $5,
    business_city = $6,
    business_province = $7,
    business_postal_code = $8,
    business_website = $9
    where id = $10 RETURNING *;`;
  return db
    .query(query, [business.name, business.description, business.phone_number, business.email, business.street_address, business.city, business.province, business.postal_code, business.website, business.id])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error updating profile: ", err);
    });

};

const updateUserProfile = async (userId, worker) => {
  try {
    // Update the workers table and retrieve the updated row
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
       RETURNING *;`, // Return updated row
      [userId, worker.biography, worker.phone_number, worker.street_address, worker.city, worker.province, worker.postal_code, worker.desired_work_radius, worker.skills, worker.desired_pay]
    );

    // Update the users table and retrieve the updated row
    const updatedUser = await db.query(
      `UPDATE users
       SET firstname = $2,
           lastname = $3
       WHERE id = $1
       RETURNING *;`, // Return updated row
      [userId, worker.firstname, worker.lastname]
    );

    // Return the updated worker and user data
    return updatedWorker.rows[0];
  } catch (error) {
    console.error("Error updating profile: ", error);
    throw error;
  }
};

const updateWorkerProfileById = async (workerId, worker) => {
  try {
    // Update the workers table (profile-specific data)
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
        worker.desired_pay
      ]
    );

    // If phone/address data is provided, update user-level data too
    if (worker.phone_number || worker.street_address || worker.city || worker.province || worker.postal_code) {
      // Get the user_id from the worker
      const workerData = await db.query(
        `SELECT user_id FROM workers WHERE id = $1;`,
        [workerId]
      );

      if (workerData.rows.length > 0) {
        const userId = workerData.rows[0].user_id;

        // Update phone number in users table
        if (worker.phone_number) {
          await db.query(
            `UPDATE users SET user_phone_number = $1 WHERE id = $2;`,
            [worker.phone_number, userId]
          );
        }

        // Update address in locations table
        if (worker.street_address || worker.city || worker.province || worker.postal_code) {
          // Get the location_id for this user
          const userData = await db.query(
            `SELECT user_address FROM users WHERE id = $1;`,
            [userId]
          );

          if (userData.rows.length > 0 && userData.rows[0].user_address) {
            const locationId = userData.rows[0].user_address;

            await db.query(
              `UPDATE locations
               SET streetaddress = COALESCE($1, streetaddress),
                   city = COALESCE($2, city),
                   province = COALESCE($3, province),
                   postalcode = COALESCE($4, postalcode)
               WHERE location_id = $5;`,
              [
                worker.street_address,
                worker.city,
                worker.province,
                worker.postal_code,
                locationId
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
  const query = `SELECT users.id,
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
  locations.postalcode AS postal_code
FROM users
JOIN workers ON users.id = workers.user_id
JOIN locations ON users.user_address = locations.location_id
WHERE users.id = $1;`;

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
    SELECT users.id,
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
      locations.postalcode AS postal_code
    FROM users
    JOIN workers ON users.id = workers.user_id
    JOIN locations ON users.user_address = locations.location_id
    WHERE workers.id = $1;
  `;

  return db.query(query, [workerId]).then(r => r.rows[0]);
};

const createWorkerProfile = async (userId, profileName) => {
  // get existing worker to copy name defaults (minimal UX)
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
    // First, manually delete associated records from junction tables
    // (CASCADE isn't set up in the current schema)
    await db.query(`DELETE FROM workers_skills WHERE workers_id = $1;`, [workerId]);
    await db.query(`DELETE FROM workers_traits WHERE workers_id = $1;`, [workerId]);
    await db.query(`DELETE FROM workers_experiences WHERE workers_id = $1;`, [workerId]);

    // Then delete the profile itself
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
  updateBusinessProfile
};