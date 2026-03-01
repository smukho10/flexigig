// backend/src/database/routes/job_routes.js
const express = require("express");
const router = express.Router();

const job_queries = require("../queries/job_queries.js");
const user_queries = require("../queries/user_queries.js");

const VALID_STATUSES = ["draft", "open", "in-review", "filled", "completed"];

router.get("/jobs/posted-jobs/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const jobs = await job_queries.fetchPostedJobsByUserId(userId);
    return res.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch posted jobs:", error);
    return res.status(500).json({
      message: "Failed to fetch posted jobs",
      error: error.message,
    });
  }
});

router.get("/jobs/unfilled-jobs/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const jobs = await job_queries.fetchUnfilledJobsByUserId(userId);
    return res.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch unfilled jobs:", error);
    return res.status(500).json({
      message: "Failed to fetch unfilled jobs",
      error: error.message,
    });
  }
});

router.get("/jobs/filled-jobs/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const jobs = await job_queries.fetchFilledJobsByUserId(userId);
    return res.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch filled jobs:", error);
    return res.status(500).json({
      message: "Failed to fetch filled jobs",
      error: error.message,
    });
  }
});

router.post("/jobs/post-job", async (req, res) => {
  console.log("Received job post data:", JSON.stringify(req.body, null, 2));
  try {
    const {
      jobStreetAddress,
      jobCity,
      jobProvince,
      jobPostalCode,
      user_id,
      status,
      ...jobData
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        message: "User ID is required to post a job",
      });
    }

    const locationData = {
      jobStreetAddress,
      jobCity,
      jobProvince,
      jobPostalCode,
    };

    const location = await job_queries.insertLocation(locationData);
    const location_id = location.location_id;

    const newJob = await job_queries.postJob({
      ...jobData,
      user_id,
      location_id,
      status: VALID_STATUSES.includes(status) ? status : "open",
    });

    return res.status(201).json({
      message: "Job and Location successfully created",
      job: newJob,
      location,
    });
  } catch (error) {
    console.error("Failed to create job and location:", error);
    return res.status(500).json({
      message: "Failed to create job and location",
      error: error.message,
    });
  }
});

router.get("/jobs/edit-job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  try {
    const job = await job_queries.fetchJobByJobId(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    return res.json(job);
  } catch (error) {
    console.error("Failed to fetch job details:", error);
    return res.status(500).json({
      message: "Failed to fetch job details",
      error: error.message,
    });
  }
});

router.patch("/jobs/edit-job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const jobData = req.body;

  if (jobData.status && !VALID_STATUSES.includes(jobData.status)) {
    jobData.status = "open";
  }

  try {
    const updatedJob = await job_queries.updateJob(parseInt(jobId, 10), jobData);
    if (!updatedJob) {
      return res.status(404).json({ message: "Job not found" });
    }
    return res.json({ message: "Job successfully updated", job: updatedJob });
  } catch (error) {
    console.error("Failed to update job:", error);
    return res.status(500).json({
      message: "Failed to update job",
      error: error.message,
    });
  }
});

router.patch("/jobs/job-status/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  try {
    const updatedJob = await job_queries.updateJobStatus(parseInt(jobId, 10), status);
    if (!updatedJob) {
      return res.status(404).json({ message: "Job not found" });
    }
    return res.json({ message: "Job status updated", job: updatedJob });
  } catch (error) {
    console.error("Failed to update job status:", error);
    return res.status(500).json({
      message: "Failed to update job status",
      error: error.message,
    });
  }
});

router.delete("/jobs/delete-job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    await job_queries.deleteJobById(jobId);
    return res.json({ message: "Job successfully deleted" });
  } catch (error) {
    console.error("Failed to delete job:", error);
    return res.status(500).json({
      message: "Failed to delete job",
      error: error.message,
    });
  }
});

router.get("/jobs/all-jobs", async (req, res) => {
  try {
    const { page: pageRaw, perPage: perPageRaw, ...filters } = req.query;

    const page = pageRaw ? parseInt(pageRaw, 10) : 1;
    const perPage = perPageRaw ? parseInt(perPageRaw, 10) : 10;

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ message: "page must be an integer >= 1" });
    }

    if (!Number.isInteger(perPage) || ![10, 20].includes(perPage)) {
      return res.status(400).json({ message: "perPage must be either 10 or 20" });
    }

    const { jobs, total } = await job_queries.fetchAllJobs({ filters, page, perPage });
    const totalPages = Math.ceil(total / perPage);

    return res.json({
      jobs,
      pagination: {
        page,
        perPage,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Failed to fetch all jobs:", error);
    return res.status(500).json({
      message: "Failed to fetch all jobs",
      error: error.message,
    });
  }
});

router.patch("/jobs/apply-job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const applicantId = req.body.applicantId;

  try {
    await job_queries.applyForJob(jobId, applicantId);

    // Respond immediately
    res.json({ message: "Applied successfully" });

    // Fire-and-forget: send system message AFTER response; never touch res again.
    setImmediate(async () => {
      try {
        const job = await job_queries.fetchJobByJobId(jobId);

        const posterId = job?.user_id;
        const title = job?.jobtitle || job?.jobTitle || "this gig";

        if (posterId && applicantId) {
          await user_queries.sendMessage(
            posterId,
            applicantId,
            `Booking confirmed for "${title}". You have been booked for this gig.`,
            parseInt(jobId, 10),
            true
          );
        }
      } catch (msgErr) {
        console.error("Error sending booking confirmation message:", msgErr);
      }
    });

    return;
  } catch (error) {
    console.error("Error applying for job:", error);
    return res.status(500).json({
      message: "Error applying for job",
      error: error.message,
    });
  }
});

router.get("/jobs/applied-jobs/:applicantId", async (req, res) => {
  const { applicantId } = req.params;

  try {
    const appliedJobs = await job_queries.fetchAppliedJobs(applicantId);
    return res.json({ jobs: appliedJobs });
  } catch (error) {
    console.error("Error fetching applied jobs:", error);
    return res.status(500).json({ message: "Error fetching applied jobs" });
  }
});

router.patch("/jobs/remove-application/:applicantId/job/:jobId", async (req, res) => {
  const { applicantId, jobId } = req.params;

  try {
    await job_queries.removeApplication(applicantId, jobId);
    return res.json({ message: "Application removed successfully" });
  } catch (error) {
    console.error("Error removing job application:", error);
    return res.status(500).json({ message: "Error removing job application" });
  }
});

module.exports = router;