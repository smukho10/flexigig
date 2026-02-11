const express = require('express');
const router = express.Router();
const profile_queries = require('../queries/profile_queries.js');

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


module.exports = router;