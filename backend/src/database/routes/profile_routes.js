const express = require('express');
const router = express.Router();
const profile_queries = require('../queries/profile_queries.js');
const workers_queries = require('../queries/workers_queries.js');
const { validateAddress } = require("../middleware/addressValidation");

// Employer-facing endpoint: fetch full applicant profile by worker_profile_id
router.get("/applicant-profile/:workerId", async (req, res) => {
  const workerId = parseInt(req.params.workerId, 10);
  if (isNaN(workerId)) {
    return res.status(400).json({ message: "Invalid workerId" });
  }
  try {
    const [profile, skills, experiences] = await Promise.all([
      profile_queries.getProfileByWorkerId(workerId),
      workers_queries.getWorkerSkillsWithId(workerId),
      workers_queries.getWorkerExperiencesWithId(workerId),
    ]);

    if (!profile) {
      return res.status(404).json({ message: "Applicant profile not found" });
    }

    res.json({ profile, skills, experiences });
  } catch (err) {
    console.error("Error fetching applicant profile:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/profile/worker-profiles/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    // ONLY workers should have multiple profiles
    // (user.isbusiness=true => employer)
    const userRow = await require("../connection.js").query(
      `SELECT isbusiness FROM users WHERE id = $1;`,
      [userId]
    );

    if (userRow.rows.length === 0) return res.status(404).json({ message: "User not found" });
    if (userRow.rows[0].isbusiness) return res.status(403).json({ message: "Employers cannot have profiles" });

    const profiles = await profile_queries.listWorkerProfiles(userId);
    res.json(profiles);
  } catch (e) {
    console.error("Error listing worker profiles:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/profile/worker-id/:id", (req, res) => {
  const userId = req.params.id;

  profile_queries.checkWorkerProfile(userId)
    .then((workerId) => {
      res.json(workerId);
      return;
      });
});

router.get("/profile/:id", (req, res) => {
  const userId = req.params.id;
  const workerId = req.query.workerId;

  const profilePromise = workerId
    ? profile_queries.getProfileByWorkerId(workerId)
    : profile_queries.getProfile(userId);

  profilePromise.then((profileData) => {
    const response = { profileData };

    profile_queries.getBusinessProfile(userId)
      .then((businessProfile) => {
        if (businessProfile) {
          businessProfile["business_id"] = businessProfile["id"];
          delete businessProfile["id"];
          response["businessData"] = businessProfile;
        }
        res.json(response);
      });
  });
});

router.post("/profile/create-worker-profile/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { profileName } = req.body;

    if (!profileName || !profileName.trim()) {
      return res.status(400).json({ message: "profileName is required" });
    }

    const userRow = await require("../connection.js").query(
      `SELECT isbusiness FROM users WHERE id = $1;`,
      [userId]
    );

    if (userRow.rows.length === 0) return res.status(404).json({ message: "User not found" });
    if (userRow.rows[0].isbusiness) return res.status(403).json({ message: "Employers cannot have profiles" });

    const existing = await profile_queries.listWorkerProfiles(userId);
    if (existing.length >= 3) {
      return res.status(400).json({ message: "Maximum 3 profiles allowed" });
    }

    const created = await profile_queries.createWorkerProfile(userId, profileName.trim());
    if (!created) return res.status(400).json({ message: "Worker base profile not found" });

    res.status(201).json(created);
  } catch (e) {
    console.error("Error creating worker profile:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/profile/delete-worker-profile/:workerId", async (req, res) => {
  try {
    const workerId = parseInt(req.params.workerId, 10);

    if (isNaN(workerId)) {
      return res.status(400).json({ message: "Invalid worker ID" });
    }

    // Get the user_id to check profile count
    const workerCheck = await require("../connection.js").query(
      `SELECT user_id FROM workers WHERE id = $1;`,
      [workerId]
    );

    if (workerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const userId = workerCheck.rows[0].user_id;

    // Check if this is the last profile (minimum 1 required)
    const profileCount = await profile_queries.listWorkerProfiles(userId);

    if (profileCount.length <= 1) {
      return res.status(400).json({
        message: "Cannot delete the last profile. At least one profile must remain."
      });
    }

    // Delete the profile
    const deleted = await profile_queries.deleteWorkerProfile(workerId);

    if (!deleted) {
      return res.status(500).json({ message: "Failed to delete profile" });
    }

    res.status(200).json({
      message: "Profile deleted successfully",
      deletedProfile: deleted
    });
  } catch (e) {
    console.error("Error deleting worker profile:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/profile/update-worker-profile/:workerId", async (req, res) => {
  try {
    const workerId = parseInt(req.params.workerId, 10);

    if (isNaN(workerId)) {
      return res.status(400).json({ message: "Invalid worker ID" });
    }

    const worker = {
      biography: req.body.biography,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      profile_name: req.body.profile_name,
      desired_work_radius: req.body.desired_work_radius,
      desired_pay: req.body.desired_pay,
      // User-level data (phone and address)
      phone_number: req.body.worker_phone_number,
      street_address: req.body.worker_street_address,
      city: req.body.worker_city,
      province: req.body.worker_province,
      postal_code: req.body.worker_postal_code
    };

    const addressValidation = await validateAddress({
      streetAddress: worker.street_address,
      city: worker.city,
      province: worker.province,
      postalCode: worker.postal_code,
    });

    if (!addressValidation.isValid) {
      return res.status(400).json({ message: addressValidation.message });
    }

    if (addressValidation.shouldValidate) {
      worker.street_address = addressValidation.cleaned.streetAddress;
      worker.city = addressValidation.cleaned.city;
      worker.province = addressValidation.cleaned.province;
      worker.postal_code = addressValidation.cleaned.postalCode;
    }

    const updatedProfile = await profile_queries.updateWorkerProfileById(workerId, worker);

    if (!updatedProfile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      profileData: updatedProfile
    });
  } catch (e) {
    console.error("Error updating worker profile:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/profile/update/:id", async (req, res) => {
  const userId = req.params.id;
  const worker = {
    biography: req.body.biography,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    phone_number: req.body.worker_phone_number,
    street_address: req.body.worker_street_address,
    city: req.body.worker_city,
    province: req.body.worker_province,
    postal_code: req.body.worker_postal_code,
    desired_work_radius: req.body.desired_work_radius,
    skills: req.body.skills,
    desired_pay: req.body.desired_pay
  };

  const business = {
    id: req.body.business_id,
    name: req.body.business_name,
    phone_number: req.body.business_phone_number,
    email: req.body.business_email,
    street_address: req.body.business_street_address,
    city: req.body.business_city,
    province: req.body.business_province,
    postal_code: req.body.business_postal_code,
    description: req.body.business_description,
    website: req.body.business_website
  };

  const workerAddressValidation = await validateAddress({
    streetAddress: worker.street_address,
    city: worker.city,
    province: worker.province,
    postalCode: worker.postal_code,
  });

  if (!workerAddressValidation.isValid) {
    return res.status(400).json({ message: workerAddressValidation.message });
  }

  if (workerAddressValidation.shouldValidate) {
    worker.street_address = workerAddressValidation.cleaned.streetAddress;
    worker.city = workerAddressValidation.cleaned.city;
    worker.province = workerAddressValidation.cleaned.province;
    worker.postal_code = workerAddressValidation.cleaned.postalCode;
  }

  const businessAddressValidation = await validateAddress({
    streetAddress: business.street_address,
    city: business.city,
    province: business.province,
    postalCode: business.postal_code,
  });

  if (!businessAddressValidation.isValid) {
    return res.status(400).json({ message: businessAddressValidation.message });
  }

  if (businessAddressValidation.shouldValidate) {
    business.street_address = businessAddressValidation.cleaned.streetAddress;
    business.city = businessAddressValidation.cleaned.city;
    business.province = businessAddressValidation.cleaned.province;
    business.postal_code = businessAddressValidation.cleaned.postalCode;
  }

  const businessReq = (
    business.name != undefined ||
    business.phone_number != undefined ||
    business.email != undefined ||
    business.street_address != undefined ||
    business.city != undefined ||
    business.province != undefined ||
    business.postal_code != undefined ||
    business.description != undefined ||
    business.website != undefined
  );

  let passbackData = {};

  if (!businessReq) {
    try {
      // Check if the user exists
      const workerProfileExists = await profile_queries.checkWorkerProfile(userId);

      if (!workerProfileExists) {
        // If user profile doesn't exist, add new profile
        let response = await profile_queries.addUserProfile(userId, worker);
        response["worker_id"] = response["id"];
        delete response["id"];
        //res.send(response);
        passbackData["profileData"] = response;
      } else {
        // If user exists, update the profile
        let updatedProfile = await profile_queries.updateUserProfile(userId, worker);
        updatedProfile["worker_id"] = updatedProfile["id"];
        delete updatedProfile["id"];
        //res.send(updatedProfile); // Sending the updated profile data
        passbackData["profileData"] = updatedProfile;
      }
    } catch (error) {
      console.error("Error updating profile: ", error);
      res.status(500).send({ error: "Internal server error" });
    }
  }

  if (businessReq) {
    try {
      const businessProfileExists = await profile_queries.checkBusinessProfile(userId);
      if (businessProfileExists) {
        let response = await profile_queries.updateBusinessProfile(business);
        //res.send(response);
        response["business_id"] = response["id"];
        delete response["id"];
        passbackData["businessData"] = response;
      } else {
        let response = await profile_queries.addBusinessProfile(userId, business);
        response["business_id"] = response["id"];
        delete response["id"];
        //res.send(response);
        passbackData["businessData"] = response;
      }
    } catch (error) {
      console.error("Error updating business profile: ", error);
      res.status(500).send({ error: "Internal server error" });
    }
  }
  
  // DEBUG: passbackData["isBusinessReq"] = businessReq

  console.log("Passback data", passbackData);

  res.send(passbackData);

});

// R2 Photo Upload Routes
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = require("../../config/r2");
const crypto = require("crypto");
const connection = require("../connection.js");

// Get upload URL (frontend will PUT file to this URL)
router.post("/profile/upload-photo-url/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const { contentType } = req.body;

    if (!contentType || !contentType.startsWith("image/")) {
      return res.status(400).json({ message: "Invalid content type" });
    }

    const key = `users/${userId}/profile-${crypto.randomUUID()}.jpg`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ uploadUrl, key });
  } catch (e) {
    console.error("Error generating upload URL:", e);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

// Save the key after upload
router.post("/profile/save-photo-key/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ message: "Key is required" });
    }

    await connection.query(
      `UPDATE users SET profile_photo_key = $1 WHERE id = $2;`,
      [key, userId]
    );

    res.json({ message: "Profile photo saved" });
  } catch (e) {
    console.error("Error saving photo key:", e);
    res.status(500).json({ message: "Failed to save photo key" });
  }
});

// Get view URL (frontend displays this)
router.get("/profile/view-photo-url/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const result = await connection.query(
      `SELECT profile_photo_key FROM users WHERE id = $1;`,
      [userId]
    );

    if (!result.rows[0] || !result.rows[0].profile_photo_key) {
      return res.status(404).json({ message: "No profile photo found" });
    }

    const key = result.rows[0].profile_photo_key;

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    });

    const viewUrl = await getSignedUrl(s3, command, {
      expiresIn: parseInt(process.env.R2_SIGNED_URL_EXPIRY || 3600),
    });

    res.json({ viewUrl });
  } catch (e) {
    console.error("Error generating view URL:", e);
    res.status(500).json({ message: "Failed to generate view URL" });
  }
});

// ── Resume Upload Routes ──────────────────────────────────────────────────────

// Get presigned upload URL for resume (PDF only)
router.post("/profile/upload-resume-url/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const { contentType } = req.body;

    if (contentType !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF files are allowed" });
    }

    const key = `workers/${workerId}/resume.pdf`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ uploadUrl, key });
  } catch (e) {
    console.error("Error generating resume upload URL:", e);
    res.status(500).json({ message: "Failed to generate resume upload URL" });
  }
});

// Save the resume key after upload
router.post("/profile/save-resume-key/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const { key } = req.body;

    if (!key) return res.status(400).json({ message: "Key is required" });

    // Fetch the existing resume key before overwriting it
    const existing = await connection.query(
      `SELECT resume_key FROM workers WHERE id = $1;`,
      [workerId]
    );
    const oldKey = existing.rows[0]?.resume_key;

    await connection.query(
      `UPDATE workers SET resume_key = $1 WHERE id = $2;`,
      [key, workerId]
    );

    // If the old key is different (e.g. a legacy random UUID key), delete the
    // orphaned object from Cloudflare R2 to avoid wasting storage
    if (oldKey && oldKey !== key) {
      try {
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: oldKey,
        }));
      } catch (deleteErr) {
        // Log but do not fail the request — the DB update already succeeded
        console.error("Warning: failed to delete old resume from R2:", deleteErr);
      }
    }

    res.json({ message: "Resume saved" });
  } catch (e) {
    console.error("Error saving resume key:", e);
    res.status(500).json({ message: "Failed to save resume key" });
  }
});

// Get presigned view URL for resume
router.get("/profile/view-resume-url/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;

    const result = await connection.query(
      `SELECT resume_key FROM workers WHERE id = $1;`,
      [workerId]
    );

    if (!result.rows[0]?.resume_key) {
      return res.status(404).json({ message: "No resume found" });
    }

    const resumeKey = result.rows[0].resume_key;

    // Verify the file still exists in R2 before generating a presigned URL
    try {
      await s3.send(new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: resumeKey,
      }));
    } catch (headErr) {
      if (headErr.name === "NotFound" || headErr.$metadata?.httpStatusCode === 404) {
        // File was deleted directly from R2 — clear the stale key from the DB
        await connection.query(
          `UPDATE workers SET resume_key = NULL WHERE id = $1;`,
          [workerId]
        );
        return res.status(404).json({ message: "Resume file no longer exists" });
      }
      throw headErr;
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: resumeKey,
    });

    const viewUrl = await getSignedUrl(s3, command, {
      expiresIn: parseInt(process.env.R2_SIGNED_URL_EXPIRY || 3600),
    });

    res.json({ viewUrl });
  } catch (e) {
    console.error("Error generating resume view URL:", e);
    res.status(500).json({ message: "Failed to generate resume view URL" });
  }
});

// Delete resume
router.delete("/profile/delete-resume/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;

    await connection.query(
      `UPDATE workers SET resume_key = NULL WHERE id = $1;`,
      [workerId]
    );

    res.json({ message: "Resume deleted" });
  } catch (e) {
    console.error("Error deleting resume:", e);
    res.status(500).json({ message: "Failed to delete resume" });
  }
});

module.exports = router;