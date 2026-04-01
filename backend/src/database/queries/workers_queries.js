const db = require('../connection.js');

const fetchWorkers = () => {
  const query = `
    SELECT
      w.*,
      l.city,
      l.province,
      COALESCE(r.avg_rating, 0) AS avg_rating,
      COALESCE(r.ratings_count, 0) AS ratings_count,
      COALESCE(
        ARRAY(
          SELECT DISTINCT s.skill_name
          FROM workers_skills ws
          INNER JOIN skills s ON ws.skill_id = s.skill_id
          WHERE ws.workers_id = w.id
          ORDER BY s.skill_name
        ),
        ARRAY[]::text[]
      ) AS skills,
      COALESCE(
        ARRAY(
          SELECT DISTINCT e.experience_name
          FROM workers_experiences we
          INNER JOIN experiences e ON we.experience_id = e.experience_id
          WHERE we.workers_id = w.id
          ORDER BY e.experience_name
        ),
        ARRAY[]::text[]
      ) AS experiences,
      COALESCE(
        ARRAY(
          SELECT DISTINCT t.trait_name
          FROM workers_traits wt
          INNER JOIN traits t ON wt.trait_id = t.trait_id
          WHERE wt.workers_id = w.id
          ORDER BY t.trait_name
        ),
        ARRAY[]::text[]
      ) AS traits
    FROM workers w
    LEFT JOIN users u
      ON w.user_id = u.id
    LEFT JOIN locations l
      ON u.user_address = l.location_id
    LEFT JOIN (
      SELECT
        reviewee_id,
        AVG(rating) AS avg_rating,
        COUNT(rating) AS ratings_count
      FROM reviews
      WHERE rating IS NOT NULL
      GROUP BY reviewee_id
    ) r
      ON r.reviewee_id = w.user_id
    ORDER BY w.id;
  `

  return db
    .query(query)
    .then((result) => {
      return result.rows
    })
    .catch((err) => {
      console.error("Error fetching workers:", err);
      throw err;
    });
}

const fetchWorkersForBoard = ({ jobId, distanceKm, skill, rating }) => {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  conditions.push(`1=1`);

  if (jobId) {
    conditions.push(`jp.job_id = $${paramIndex}`);
    params.push(jobId);
    paramIndex++;
  }

  if (skill) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM workers_skills ws_filter
        INNER JOIN skills s_filter ON ws_filter.skill_id = s_filter.skill_id
        WHERE ws_filter.workers_id = w.id
          AND s_filter.skill_name = $${paramIndex}
      )
    `);
    params.push(skill);
    paramIndex++;
  }

  if (rating !== null && rating !== undefined && rating !== '') {
    conditions.push(`COALESCE(r.avg_rating, 0) >= $${paramIndex}`);
    params.push(rating);
    paramIndex++;
  }

  if (jobId && distanceKm) {
    conditions.push(`jl.latitude IS NOT NULL`);
    conditions.push(`jl.longitude IS NOT NULL`);
    conditions.push(`wl.latitude IS NOT NULL`);
    conditions.push(`wl.longitude IS NOT NULL`);
    conditions.push(`
      (
        6371 * acos(
          LEAST(
            1,
            GREATEST(
              -1,
              cos(radians(jl.latitude)) *
              cos(radians(wl.latitude)) *
              cos(radians(wl.longitude) - radians(jl.longitude)) +
              sin(radians(jl.latitude)) *
              sin(radians(wl.latitude))
            )
          )
        )
      ) <= $${paramIndex}
    `);
    params.push(distanceKm);
    paramIndex++;
  }

  const query = `
    SELECT
      w.*,
      wl.city,
      wl.province,
      COALESCE(r.avg_rating, 0) AS avg_rating,
      COALESCE(r.ratings_count, 0) AS ratings_count,
      CASE
        WHEN jl.latitude IS NOT NULL
          AND jl.longitude IS NOT NULL
          AND wl.latitude IS NOT NULL
          AND wl.longitude IS NOT NULL
        THEN (
          6371 * acos(
            LEAST(
              1,
              GREATEST(
                -1,
                cos(radians(jl.latitude)) *
                cos(radians(wl.latitude)) *
                cos(radians(wl.longitude) - radians(jl.longitude)) +
                sin(radians(jl.latitude)) *
                sin(radians(wl.latitude))
              )
            )
          )
        )
        ELSE NULL
      END AS distance_km,
      COALESCE(
        ARRAY(
          SELECT DISTINCT s.skill_name
          FROM workers_skills ws
          INNER JOIN skills s ON ws.skill_id = s.skill_id
          WHERE ws.workers_id = w.id
          ORDER BY s.skill_name
        ),
        ARRAY[]::text[]
      ) AS skills,
      COALESCE(
        ARRAY(
          SELECT DISTINCT e.experience_name
          FROM workers_experiences we
          INNER JOIN experiences e ON we.experience_id = e.experience_id
          WHERE we.workers_id = w.id
          ORDER BY e.experience_name
        ),
        ARRAY[]::text[]
      ) AS experiences,
      COALESCE(
        ARRAY(
          SELECT DISTINCT t.trait_name
          FROM workers_traits wt
          INNER JOIN traits t ON wt.trait_id = t.trait_id
          WHERE wt.workers_id = w.id
          ORDER BY t.trait_name
        ),
        ARRAY[]::text[]
      ) AS traits
    FROM workers w
    LEFT JOIN users u
      ON w.user_id = u.id
    LEFT JOIN locations wl
      ON u.user_address = wl.location_id
    LEFT JOIN (
      SELECT
        reviewee_id,
        AVG(rating) AS avg_rating,
        COUNT(rating) AS ratings_count
      FROM reviews
      WHERE rating IS NOT NULL
      GROUP BY reviewee_id
    ) r
      ON r.reviewee_id = w.user_id
    LEFT JOIN jobpostings jp
      ON jp.job_id = ${jobId ? `$1` : `NULL`}
    LEFT JOIN locations jl
      ON jp.location_id = jl.location_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE
        WHEN ${jobId && distanceKm ? 'TRUE' : 'FALSE'} THEN
          CASE
            WHEN jl.latitude IS NOT NULL
              AND jl.longitude IS NOT NULL
              AND wl.latitude IS NOT NULL
              AND wl.longitude IS NOT NULL
            THEN (
              6371 * acos(
                LEAST(
                  1,
                  GREATEST(
                    -1,
                    cos(radians(jl.latitude)) *
                    cos(radians(wl.latitude)) *
                    cos(radians(wl.longitude) - radians(jl.longitude)) +
                    sin(radians(jl.latitude)) *
                    sin(radians(wl.latitude))
                  )
                )
              )
            )
            ELSE NULL
          END
        ELSE NULL
      END ASC NULLS LAST,
      w.id;
  `

  return db
    .query(query, params)
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error fetching workers for board:", err);
      throw err;
    });
}

const getAllSkills = () => {
  const query = "SELECT * FROM skills ORDER BY skill_name ASC";

  return db
    .query(query)
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting all skills:", err);
      throw err;
    });
}

const getAllExperiences = () => {
  const query = "SELECT * FROM experiences";

  return db
    .query(query)
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting all experiences:", err);
      throw err;
    });
}

const getAllTraits = () => {
  const query = "SELECT * FROM traits";

  return db
    .query(query)
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting all traits:", err);
      throw err;
    });
}

// Accociates a selected skill to the user
const addWorkerSkill = (workersId, skillId) => {
  const query = `INSERT INTO workers_skills (workers_id, skill_id) VALUES ($1, $2) RETURNING *;`;
  console.log("addWorkerSkill() called:", workersId, skillId);

  return db
    .query(query, [workersId, skillId])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error adding worker skill:", err);
      throw err;
    });
};

// Clears all skills from a user
const clearWorkerSkills = (workersId) => {
  const query = `DELETE FROM workers_skills WHERE workers_id = $1;`;
  console.log("clearWorkerSkills() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result;
    })
    .catch((err) => {
      console.error("Error clearing worker skills:", err);
      throw err;
    });
};

// Clears all traits from a user
const clearWorkerTraits = (workersId) => {
  const query = `DELETE FROM workers_traits WHERE workers_id = $1;`;
  console.log("clearWorkerTraits() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result;
    })
    .catch((err) => {
      console.error("Error clearing worker traits:", err);
      throw err;
    });
};

// Clears all experiences from a user
const clearWorkerExperiences = (workersId) => {
  const query = `DELETE FROM workers_experiences WHERE workers_id = $1;`;
  console.log("clearWorkerExperiences() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result;
    })
    .catch((err) => {
      console.error("Error clearing worker experiences:", err);
      throw err;
    });
};

// Get all skills of a specified user
const getWorkerSkills = (workersId) => {
  const query = `SELECT workers_id, skill_name FROM workers INNER JOIN workers_skills ON workers.id = workers_skills.workers_id INNER JOIN skills ON workers_skills.skill_id = skills.skill_id WHERE workers_id=$1;`;
  console.log("getWorkerSkills() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting worker skills:", err);
      throw err;
    });
}

// As above, but with the skills' id, not the user (for adding and removing skills)
const getWorkerSkillsWithId = (workersId) => {
  const query = `SELECT skills.skill_id, skill_name FROM workers INNER JOIN workers_skills ON workers.id = workers_skills.workers_id INNER JOIN skills ON workers_skills.skill_id = skills.skill_id WHERE workers_id=$1;`;
  console.log("getWorkerSkills() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting worker skills:", err);
      throw err;
    });
}

// Accociates a selected experience to the user
const addWorkerExperience = (workersId, experienceId) => {
  const query = `INSERT INTO workers_experiences (workers_id, experience_id) VALUES ($1, $2) RETURNING *;`;
  console.log("addWorkerExperience() called:", workersId, experienceId);

  return db
    .query(query, [workersId, experienceId])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error adding worker experience:", err);
      throw err;
    });
};

// Get all experiences of a specified user
const getWorkerExperiences = (workersId) => {
  const query = `SELECT workers_id, experience_name FROM workers INNER JOIN workers_experiences ON workers.id = workers_experiences.workers_id INNER JOIN experiences ON workers_experiences.experience_id = experiences.experience_id WHERE workers_id=$1;`;
  console.log("getWorkerExperiences() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting worker experiences:", err);
      throw err;
    });
}

// As above, but with the experiences' id, not the user (for adding and removing experience)
const getWorkerExperiencesWithId = (workersId) => {
  const query = `SELECT experiences.experience_id, experience_name FROM workers INNER JOIN workers_experiences ON workers.id = workers_experiences.workers_id INNER JOIN experiences ON workers_experiences.experience_id = experiences.experience_id WHERE workers_id=$1;`;
  console.log("getWorkerExperiences() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting worker experiences:", err);
      throw err;
    });
}

// Accociates a selected trait to the user
const addWorkerTrait = (workersId, traitId) => {
  const query = `INSERT INTO workers_traits (workers_id, trait_id) VALUES ($1, $2) RETURNING *;`;
  console.log("addWorkerTrait() called:", workersId, traitId);

  return db
    .query(query, [workersId, traitId])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error("Error adding worker trait:", err);
      throw err;
    });
};

// Get all traits of a specified user
const getWorkerTraits = (workersId) => {
  const query = `SELECT workers_id, trait_name FROM workers INNER JOIN workers_traits ON workers.id = workers_traits.workers_id INNER JOIN traits ON workers_traits.trait_id = traits.trait_id WHERE workers_id=$1;`;
  console.log("getWorkerTraits() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting worker traits:", err);
      throw err;
    });
}

// As above, but with the traits' id, not the user (for adding and removing traits)
const getWorkerTraitsWithId = (workersId) => {
  const query = `SELECT traits.trait_id, trait_name FROM workers INNER JOIN workers_traits ON workers.id = workers_traits.workers_id INNER JOIN traits ON workers_traits.trait_id = traits.trait_id WHERE workers_id=$1;`;
  console.log("getWorkerTraits() called:", workersId);

  return db
    .query(query, [workersId])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error("Error getting worker skills:", err);
      throw err;
    });
}

module.exports = {
  fetchWorkers,
  fetchWorkersForBoard,
  getAllSkills,
  getAllExperiences,
  getAllTraits,
  addWorkerSkill,
  clearWorkerSkills,
  clearWorkerTraits,
  clearWorkerExperiences,
  getWorkerSkills,
  getWorkerSkillsWithId,
  addWorkerExperience,
  getWorkerExperiences,
  getWorkerExperiencesWithId,
  addWorkerTrait,
  getWorkerTraits,
  getWorkerTraitsWithId
}