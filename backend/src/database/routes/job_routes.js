// backend/src/database/routes/job_routes.js
const express = require("express");
const router = express.Router();
const job_queries = require("../queries/job_queries.js");
const { validateAddress } = require("../middleware/addressValidation");
const { sendNewGigNotifications } = require("../../services/notificationScheduler.js");

const VALID_STATUSES = ["draft", "open", "in-review", "filled", "completed"];
const MILES_TO_KM = 1.60934;

const handleApplyRequest = async (req, res) => {
  const { jobId } = req.params;
  const jobIdInt = parseInt(jobId, 10);

  const worker_profile_id =
    req.body.worker_profile_id ?? req.body.applicantId ?? req.body.applicant_id;

  if (isNaN(jobIdInt) || !worker_profile_id) {
      return res
        .status(400)
        .json({ message: "jobId and worker_profile_id are required" });
    }

  const jobState = await job_queries.fetchJobLockState(jobIdInt);
  if (!jobState) return res.status(404).json({ message: "Job not found" });

  if (jobState.locked) {
    return res.status(409).json({ message: "This job is no longer accepting applications." });
  }

  try {
    // 1) Get employer_id from jobPostings
    const jobRes = await job_queries.getEmployerIdForJob(jobIdInt);
    if (!jobRes) {
      return res.status(404).json({ message: "Job not found" });
    }

    const employerId = jobRes.employer_id;

    // 2) Insert application
    const application = await job_queries.insertGigApplication({
      job_id: jobIdInt,
      employer_id: employerId,
      worker_profile_id,
    });

    return res.status(201).json({ message: "Applied successfully", application });
  } catch (err) {
    if (err && err.code === "23505") {
      return res
        .status(409)
        .json({ message: "Duplicate application not allowed." });
    }

    console.error("Error applying for job:", err);
    return res.status(500).json({ message: "Error applying for job" });
  }
};


router.get("/posted-jobs/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const jobs = await job_queries.fetchPostedJobsByUserId(userId);
    res.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch posted jobs:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch posted jobs", error: error.message });
  }
});

router.get("/unfilled-jobs/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const jobs = await job_queries.fetchUnfilledJobsByUserId(userId);
    res.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch unfilled jobs:", error);
    res.status(500).json({
      message: "Failed to fetch unfilled jobs",
      error: error.message,
    });
  }
});

router.get("/filled-jobs/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const jobs = await job_queries.fetchFilledJobsByUserId(userId);
    res.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch filled jobs:", error);
    res.status(500).json({
      message: "Failed to fetch filled jobs",
      error: error.message,
    });
  }
});

router.post("/post-job", async (req, res) => {
  console.log("Received job post data:", JSON.stringify(req.body, null, 2));
  try {
    const {
      jobStreetAddress,
      jobCity,
      jobProvince,
      jobPostalCode,
      user_id,
      status,
      requiredSkills,      // ← NEW
      requiredExperience,  // ← NEW
      ...jobData
    } = req.body;

    if (!user_id) {
      console.error("Missing user_id in job post data");
      return res.status(400).json({
        message: "User ID is required to post a job",
      });
    }

    const addressValidation = await validateAddress({
      streetAddress: jobStreetAddress,
      city: jobCity,
      province: jobProvince,
      postalCode: jobPostalCode,
    });

    if (!addressValidation.isValid) {
      return res.status(400).json({ message: addressValidation.message });
    }

    const locationData = {
      jobStreetAddress: addressValidation.cleaned.streetAddress,
      jobCity: addressValidation.cleaned.city,
      jobProvince: addressValidation.cleaned.province,
      jobPostalCode: addressValidation.cleaned.postalCode,
    };
    const location = await job_queries.insertLocation(locationData);
    const location_id = location.location_id;

    const newJob = await job_queries.postJob({
      ...jobData,
      user_id,
      location_id,
      status: VALID_STATUSES.includes(status) ? status : "open",
      requiredSkills:     Array.isArray(requiredSkills)     ? requiredSkills     : [],
      requiredExperience: Array.isArray(requiredExperience) ? requiredExperience : [],
    });

    if (newJob.status === "open") {
      sendNewGigNotifications().catch(err =>
        console.error("[Notifications] Failed to send new gig notifications:", err)
      );
    }

    res.status(201).json({
      message: "Job and Location successfully created",
      job: newJob,
      location: location,
    });
  } catch (error) {
    console.error("Failed to create job and location:", error);
    res.status(500).json({
      message: "Failed to create job and location",
      error: error.message,
    });
  }
});

router.get("/edit-job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  try {
    const job = await job_queries.fetchJobByJobId(jobId);
    if (job) {
      res.json(job);
    } else {
      res.status(404).send({ message: "Job not found" });
    }
  } catch (error) {
    console.error("Failed to fetch job details:", error);
    res.status(500).send({
      message: "Failed to fetch job details",
      error: error.message,
    });
  }
});

router.patch("/edit-job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const jobData = req.body;

  if (jobData.status && !VALID_STATUSES.includes(jobData.status)) {
    jobData.status = "open";
  }

  // Normalise arrays coming from the frontend
  jobData.requiredSkills     = Array.isArray(jobData.requiredSkills)     ? jobData.requiredSkills     : [];
  jobData.requiredExperience = Array.isArray(jobData.requiredExperience) ? jobData.requiredExperience : [];

  try {
    const addressValidation = await validateAddress({
      streetAddress: jobData.jobStreetAddress,
      city: jobData.jobCity,
      province: jobData.jobProvince,
      postalCode: jobData.jobPostalCode,
    });

    if (!addressValidation.isValid) {
      return res.status(400).json({ message: addressValidation.message });
    }

    if (addressValidation.shouldValidate) {
      jobData.jobStreetAddress = addressValidation.cleaned.streetAddress;
      jobData.jobCity = addressValidation.cleaned.city;
      jobData.jobProvince = addressValidation.cleaned.province;
      jobData.jobPostalCode = addressValidation.cleaned.postalCode;
    }

    const updatedJob = await job_queries.updateJob(parseInt(jobId, 10), jobData);
    if (updatedJob) {
      res.json({ message: "Job successfully updated", job: updatedJob });
    } else {
      res.status(404).json({ message: "Job not found" });
    }
  } catch (error) {
    console.error("Failed to update job:", error);
    res.status(500).json({
      message: "Failed to update job",
      error: error.message,
    });
  }
});

router.patch("/job-status/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  try {
    const updatedJob = await job_queries.updateJobStatus(parseInt(jobId, 10), status);
    if (updatedJob) {
      if (status === "open") {
        sendNewGigNotifications().catch(err =>
          console.error("[Notifications] Failed to send new gig notifications:", err)
        );
      }
      res.json({ message: "Job status updated", job: updatedJob });
    } else {
      res.status(404).json({ message: "Job not found" });
    }
  } catch (error) {
    console.error("Failed to update job status:", error);
    res.status(500).json({
      message: "Failed to update job status",
      error: error.message,
    });
  }
});

router.delete("/delete-job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    await job_queries.deleteJobById(jobId);
    res.json({ message: "Job successfully deleted" });
  } catch (error) {
    console.error("Failed to delete job:", error);
    res.status(500).json({
      message: "Failed to delete job",
      error: error.message,
    });
  }
});

router.patch("/jobs/:jobId/lock", async (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  const { locked } = req.body;

  if (!Number.isInteger(jobId)) {
    return res.status(400).json({ message: "Invalid jobId" });
  }
  if (typeof locked !== "boolean") {
    return res.status(400).json({ message: "locked must be boolean" });
  }

  try {
    const updated = await job_queries.setJobLocked(jobId, locked);
    if (!updated) return res.status(404).json({ message: "Job not found" });
    return res.json({ message: locked ? "Job locked" : "Job unlocked", job: updated });
  } catch (err) {
    console.error("Error toggling lock:", err);
    return res.status(500).json({ message: "Error toggling lock", error: err.message });
  }
});

router.get("/all-jobs", async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const perPage = req.query.perPage ? parseInt(req.query.perPage, 10) : 10;

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ message: "page must be an integer >= 1" });
    }

    if (!Number.isInteger(perPage) || ![10, 20].includes(perPage)) {
      return res.status(400).json({ message: "perPage must be either 10 or 20" });
    }

    const distanceKm =
      req.query.distanceKm != null && req.query.distanceKm !== ""
        ? req.query.distanceKm
        : req.query.distanceMiles != null && req.query.distanceMiles !== ""
          ? Number(req.query.distanceMiles) * MILES_TO_KM
          : undefined;

    const filters = {
      status: req.query.status
        ? Array.isArray(req.query.status)
          ? req.query.status
          : [req.query.status]
        : undefined,
      jobType: req.query.jobType,
      userId: req.query.userId,
      hourlyRateMin: req.query.hourlyRateMin,
      hourlyRateMax: req.query.hourlyRateMax,
      startFrom: req.query.startFrom,
      startTo: req.query.startTo,
      endFrom: req.query.endFrom,
      endTo: req.query.endTo,
      city: req.query.city,
      province: req.query.province,
      postalCode: req.query.postalCode,
      q: req.query.q,
      currentUserId: req.query.currentUserId,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,

      // Distance filter support
      originLat: req.query.originLat,
      originLon: req.query.originLon,
      distanceKm,

      // REPLACE with:
      skills: req.query.skills
        ? (Array.isArray(req.query.skills) ? req.query.skills : [req.query.skills])
        : undefined,
      experience: req.query.experience
        ? (Array.isArray(req.query.experience) ? req.query.experience : [req.query.experience])
        : undefined,
    };

    const { jobs, total } = await job_queries.fetchAllJobs({
      filters,
      page,
      perPage,
    });

    const jobsWithDistanceMiles = Array.isArray(jobs)
      ? jobs.map((job) => ({
          ...job,
          distance_miles: job.distance_km != null ? Number((Number(job.distance_km) / MILES_TO_KM).toFixed(2)) : null,
        }))
      : [];

    const totalPages = Math.ceil(total / perPage);

    return res.json({
      jobs: jobsWithDistanceMiles,
      pagination: { page, perPage, total, totalPages },
    });
  } catch (error) {
    console.error("Failed to fetch all jobs:", error);
    return res.status(500).json({
      message: "Failed to fetch all jobs",
      error: error.message,
    });
  }
});

router.post("/apply-job/:jobId", handleApplyRequest);

router.get("/applied-jobs/:applicantId", async (req, res) => {
  const { applicantId } = req.params;
  try {
    const appliedJobs = await job_queries.fetchAppliedJobs(applicantId);
    res.json({ jobs: appliedJobs });
  } catch (error) {
    console.error("Error fetching applied jobs:", error);
    res.status(500).json({ message: "Error fetching applied jobs" });
  }
});

router.patch("/applications/:applicationId/status", async (req, res) => {
  const applicationId = parseInt(req.params.applicationId, 10);
  const { status } = req.body;

  const ALLOWED = ["IN_REVIEW", "REJECTED", "ACCEPTED", "WITHDRAWN"];

  if (!Number.isInteger(applicationId)) {
    return res.status(400).json({ message: "Invalid applicationId" });
  }

  if (!status || !ALLOWED.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${ALLOWED.join(", ")}`});
  }

  try {
    const updated = await job_queries.updateGigApplicationStatus(applicationId, status);
    if (!updated) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Send a notification message to the worker when accepted
    if (status === "ACCEPTED" && updated.worker_profile_id && updated.job_id) {
      try {
        const db = require("../connection.js");
        const user_queries = require("../queries/user_queries.js");

        // Get worker's user_id from worker profile
        const workerRes = await db.query(
          `SELECT user_id FROM workers WHERE id = $1`,
          [updated.worker_profile_id]
        );
        const workerUserId = workerRes.rows[0]?.user_id;

        // Get job title
        const jobRes = await db.query(
          `SELECT jobtitle FROM jobPostings WHERE job_id = $1`,
          [updated.job_id]
        );
        const jobTitle = jobRes.rows[0]?.jobtitle || "a job";

        // Get employer/business name
        const employerDetails = await user_queries.getUserDetails(updated.employer_id);
        const employerName = employerDetails.type === "business"
          ? employerDetails.businessName
          : `${employerDetails.firstName || ""} ${employerDetails.lastName || ""}`.trim() || "the employer";

        if (workerUserId) {
          const notifContent = `Congratulations, your application has been accepted for "${jobTitle}"!`;
          await user_queries.sendMessage(
            updated.employer_id,
            workerUserId,
            notifContent,
            updated.job_id,
            false // not a system message, so it shows up in notifications
          );
        }
      } catch (notifErr) {
        // Don't fail the whole request if notification fails
        console.error("Error sending acceptance notification:", notifErr);
      }
    }

    return res.json({message: "Application status updated",application: updated});
  } catch (err) {
    console.error("Error updating application status:", err);
    return res.status(500).json({message: "Error updating application status",error: err.message});
  }
});

router.get("/job-applicants/:jobId", async (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  if (isNaN(jobId)) {
    return res.status(400).json({ message: "Invalid jobId" });
  }

  try {
    const applicants = await job_queries.fetchApplicantsForJob(jobId);
    res.json({ applicants });
  } catch (error) {
    console.error("Error fetching applicants:", error);
    res.status(500).json({ message: "Error fetching applicants", error: error.message });
  }
});

router.patch("/remove-application/:applicantId/job/:jobId", async (req, res) => {
  const { applicantId, jobId } = req.params;
  try {
    await job_queries.removeApplication(applicantId, jobId);
    res.json({ message: "Application removed successfully" });
  } catch (error) {
    console.error("Error removing job application:", error);
    res.status(500).json({ message: "Error removing job application" });
  }
});

module.exports = router;