const express = require('express');
const router = express.Router();
const workers_queries = require("../queries/workers_queries.js");
const db = require('../connection.js');
const { geocodeAddress } = require("../../services/geocodingService");

const buildFullAddress = ({ streetAddress, city, province, postalCode }) => {
  const parts = [streetAddress, city, province, postalCode]
    .map(part => typeof part === 'string' ? part.trim() : part)
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};

const parseIntegerOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseFloatOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseStringOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

router.get('/gig-workers', async (req, res) => {
  try {
    const {
      jobId,
      distanceKm,
      skill,
      rating,
      originLat,
      originLon,
      streetAddress,
      city,
      province,
      postalCode
    } = req.query;

    const normalizedJobId = parseIntegerOrNull(jobId);
    const normalizedDistanceKm = parseFloatOrNull(distanceKm);
    const normalizedSkill = parseStringOrNull(skill);
    const normalizedRating = parseFloatOrNull(rating);

    let parsedOriginLat = parseFloatOrNull(originLat);
    let parsedOriginLon = parseFloatOrNull(originLon);

    if (
      (parsedOriginLat === null || parsedOriginLon === null) &&
      (parseStringOrNull(streetAddress) || parseStringOrNull(city) || parseStringOrNull(province) || parseStringOrNull(postalCode))
    ) {
      const fullAddress = buildFullAddress({
        streetAddress,
        city,
        province,
        postalCode
      });

      if (fullAddress) {
        const geocoded = await geocodeAddress(fullAddress);
        if (geocoded) {
          parsedOriginLat = parseFloatOrNull(geocoded.latitude);
          parsedOriginLon = parseFloatOrNull(geocoded.longitude);
        }
      }
    }

    const hasBoardFilters =
      normalizedJobId !== null ||
      normalizedDistanceKm !== null ||
      normalizedSkill !== null ||
      normalizedRating !== null ||
      (parsedOriginLat !== null && parsedOriginLon !== null);

    let workers;

    if (hasBoardFilters) {
      workers = await workers_queries.fetchWorkersForBoard({
        jobId: normalizedJobId,
        distanceKm: normalizedDistanceKm,
        skill: normalizedSkill,
        rating: normalizedRating,
        originLat: parsedOriginLat,
        originLon: parsedOriginLon
      });
    } else {
      workers = await workers_queries.fetchWorkers();
    }

    console.log(workers);
    res.json(workers);
    return;
  } catch (err) {
    console.error("Error in /api/gig-workers", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/worker/:id', async (req, res) => {
  const workerId = parseInt(req.params.id, 10);

  if (isNaN(workerId)) {
    return res.status(400).json({ message: "Invalid worker ID" });
  }

  try {
    const result = await db.query(
      `
      SELECT
        w.*,
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
      WHERE w.id = $1
      `,
      [workerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Worker not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching worker:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get('/get-all-skills', async (req, res) => {
  try {
    const skills = await workers_queries.getAllSkills();
    res.status(200).json(skills);
  } catch (err) {
    console.error("Error in /api/get-all-skills", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/get-all-experiences', async (req, res) => {
  try {
    const experiences = await workers_queries.getAllExperiences();
    res.status(200).json(experiences);
  } catch (err) {
    console.error("Error in /api/get-all-experiences", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/get-all-traits', async (req, res) => {
  try {
    const traits = await workers_queries.getAllTraits();
    res.status(200).json(traits);
  } catch (err) {
    console.error("Error in /api/get-all-traits", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add-worker-skill", async (req, res) => {
  try {
    const workersId = req.session.workers_id;
    const skillId = req.session.skill_id;
    await workers_queries.addWorkerSkill(workersId, skillId);
    res.status(200).json({ success: true, message: 'Skill Added' });
  } catch (err) {
    console.error("Error in /api/add-worker-skill", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add-worker-skill-ids/:workid/:skillid", async (req, res) => {
  const workersId = req.params.workid;
  const skillId = req.params.skillid;
  try {
    await workers_queries.addWorkerSkill(workersId, skillId);
    res.status(200).json({ success: true, message: 'Skill Added' });
  } catch (err) {
    console.error("Error in /api/add-worker-skill", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clear-worker-skills/:id", async (req, res) => {
  const workersId = req.params.id;

  try {
    const conf = await workers_queries.clearWorkerSkills(workersId);
    res.json(conf);
    return;
  } catch (err) {
    console.error("Error in /api/clear-worker-skills/:id", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clear-worker-traits/:id", async (req, res) => {
  const workersId = req.params.id;

  try {
    const conf = await workers_queries.clearWorkerTraits(workersId);
    res.json(conf);
    return;
  } catch (err) {
    console.error("Error in /api/clear-worker-traits/:id", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clear-worker-experiences/:id", async (req, res) => {
  const workersId = req.params.id;

  try {
    const conf = await workers_queries.clearWorkerExperiences(workersId);
    res.json(conf);
    return;
  } catch (err) {
    console.error("Error in /api/clear-worker-experiences/:id", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-worker-skills", async (req, res) => {
  try {
    const workersId = req.session.workers_id;
    const workerSkills = await workers_queries.getWorkerSkills(workersId);
    res.json(workerSkills);
  } catch (err) {
    console.error("Error in /api/get-worker-skills", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-worker-skills-id/:id", async (req, res) => {
  const workerId = req.params.id;

  try {
    const workerSkills = await workers_queries.getWorkerSkillsWithId(workerId);
    res.json(workerSkills);
    return;
  } catch (err) {
    console.error("Error in /api/get-worker-skills-id/:id", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-worker-traits-id/:id", async (req, res) => {
  const workerId = req.params.id;

  try {
    const workerTraits = await workers_queries.getWorkerTraitsWithId(workerId);
    res.json(workerTraits);
    return;
  } catch (err) {
    console.error("Error in /api/get-worker-traits-id/:id", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-worker-experiences-id/:id", async (req, res) => {
  const workerId = req.params.id;

  try {
    const workerExp = await workers_queries.getWorkerExperiencesWithId(workerId);
    res.json(workerExp);
    return;
  } catch (err) {
    console.error("Error in /api/get-worker-experiences-id/:id", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add-worker-experience", async (req, res) => {
  try {
    const workersId = req.session.workers_id;
    const experienceId = req.session.experience_id;
    await workers_queries.addWorkerExperience(workersId, experienceId);
    res.status(200).json({ success: true, message: 'Experience Added' });
  } catch (err) {
    console.error("Error in /api/add-worker-experience", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add-worker-experience-ids/:workid/:expid", async (req, res) => {
  const workersId = req.params.workid;
  const expId = req.params.expid;
  try {
    await workers_queries.addWorkerExperience(workersId, expId);
    res.status(200).json({ success: true, message: 'Experience Added' });
  } catch (err) {
    console.error("Error in /api//add-worker-experience/:workid/:expid", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-worker-experiences", async (req, res) => {
  try {
    const workersId = req.session.workers_id;
    const workerExperiences = await workers_queries.getWorkerExperiences(workersId);
    res.json(workerExperiences);
  } catch (err) {
    console.error("Error in /api/get-worker-experiences", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add-worker-trait", async (req, res) => {
  try {
    const workersId = req.session.workers_id;
    const traitId = req.session.trait_id;
    await workers_queries.addWorkerTrait(workersId, traitId);
    res.status(200).json({ success: true, message: 'Trait Added' });
  } catch (err) {
    console.error("Error in /api/add-worker-trait", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add-worker-trait-ids/:workid/:traitid", async (req, res) => {
  const workersId = req.params.workid;
  const traitId = req.params.traitid;
  try {
    await workers_queries.addWorkerTrait(workersId, traitId);
    res.status(200).json({ success: true, message: 'Trait Added' });
  } catch (err) {
    console.error("Error in /api/add-worker-trait/:workid/:traitid", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-worker-traits", async (req, res) => {
  try {
    const workersId = req.session.workers_id;
    const workerTraits = await workers_queries.getWorkerTraits(workersId);
    res.json(workerTraits);
  } catch (err) {
    console.error("Error in /api/get-worker-traits", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;