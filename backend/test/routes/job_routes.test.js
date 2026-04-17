process.env.NODE_ENV = "test";

const request = require("supertest");
const express = require("express");

// Mock the query layer entirely before importing routes
jest.mock("../../src/database/queries/job_queries.js", () => ({
  fetchPostedJobsByUserId: jest.fn(),
  fetchJobLockState: jest.fn(),
  getEmployerIdForJob: jest.fn(),
  insertGigApplication: jest.fn(),
  fetchUnfilledJobsByUserId: jest.fn(),
  fetchFilledJobsByUserId: jest.fn(),
  insertLocation: jest.fn(),
  postJob: jest.fn(),
  fetchJobByJobId: jest.fn(),
  updateJob: jest.fn(),
  updateJobStatus: jest.fn(),
  deleteJobById: jest.fn(),
  setJobLocked: jest.fn(),
  fetchAllJobs: jest.fn(),
  fetchAppliedJobs: jest.fn(),
  updateGigApplicationStatus: jest.fn(),
  fetchApplicantsForJob: jest.fn(),
  removeApplication: jest.fn(),
}));

const jobQueries = require("../../src/database/queries/job_queries.js");

// Mock user_queries for notification functionality
jest.mock("../../src/database/queries/user_queries.js", () => ({
  getUserDetails: jest.fn(),
  insertNotification: jest.fn(),
}));

jest.mock("../../src/database/connection.js", () => ({
  query: jest.fn(),
}));

const userQueries = require("../../src/database/queries/user_queries.js");
const db = require("../../src/database/connection.js");

// Mount the router onto a fresh express app for testing
const app = express();
app.use(express.json());
const jobRouter = require("../../src/database/routes/job_routes.js");
app.use("/api", jobRouter);

describe("Job Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/posted-jobs/:userId", () => {
    
    test("returns 200 and a list of jobs including applicant_count on success", async () => {
      // Setup the mock to return jobs with the applicant_count property
      const fakeJobs = [
        {
          job_id: 1,
          jobtitle: "Bartender",
          hourlyrate: "33.00",
          applicant_count: 3,
        },
        {
          job_id: 2,
          jobtitle: "Server",
          hourlyrate: "20.00",
          applicant_count: 0,
        }
      ];

      jobQueries.fetchPostedJobsByUserId.mockResolvedValueOnce(fakeJobs);

      const userId = "123";
      const res = await request(app).get(`/api/posted-jobs/${userId}`);

      // Assertions
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("jobs");
      expect(Array.isArray(res.body.jobs)).toBe(true);
      expect(res.body.jobs).toHaveLength(2);
      
      // Verify the new applicant_count property is present and correct
      expect(res.body.jobs[0].jobtitle).toBe("Bartender");
      expect(res.body.jobs[0].applicant_count).toBe(3);
      
      expect(res.body.jobs[1].jobtitle).toBe("Server");
      expect(res.body.jobs[1].applicant_count).toBe(0);

      // Verify the mock was called correctly
      expect(jobQueries.fetchPostedJobsByUserId).toHaveBeenCalledWith(userId);
      expect(jobQueries.fetchPostedJobsByUserId).toHaveBeenCalledTimes(1);
    });

    test("returns 500 when the database query fails", async () => {
      // Setup the mock to throw an error
      jobQueries.fetchPostedJobsByUserId.mockRejectedValueOnce(new Error("Database connection error"));

      const userId = "123";
      const res = await request(app).get(`/api/posted-jobs/${userId}`);

      // Assertions
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty("message", "Failed to fetch posted jobs");
      expect(res.body).toHaveProperty("error", "Database connection error");
    });

  });
  describe("PATCH /api/applications/:applicationId/status", () => {
    test("sends an acceptance notification when status is ACCEPTED", async () => {
      const updatedApplication = {
        application_id: 1,
        job_id: 10,
        employer_id: 100,
        worker_profile_id: 200,
        status: "ACCEPTED"
      };

      jobQueries.updateGigApplicationStatus.mockResolvedValueOnce(updatedApplication);
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 201 }] }); // Worker user ID
      db.query.mockResolvedValueOnce({ rows: [{ jobtitle: "Software Engineer" }] }); // Job title

      userQueries.getUserDetails.mockResolvedValueOnce({
        type: "business",
        businessName: "Tech Corp",
      });

      const res = await request(app)
        .patch("/api/applications/1/status")
        .send({ status: "ACCEPTED" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Application status updated");
      expect(userQueries.insertNotification).toHaveBeenCalledTimes(1);
      expect(userQueries.insertNotification).toHaveBeenCalledWith(
        100,
        201,
        'Congratulations, your application has been accepted for "Software Engineer"!',
        10
      );
    });

    // ── Input validation ───────────────────────────────────────────────────────

    test("returns 400 when applicationId is not a valid integer", async () => {
      const res = await request(app)
        .patch("/api/applications/abc/status")
        .send({ status: "ACCEPTED" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid applicationId");
      expect(jobQueries.updateGigApplicationStatus).not.toHaveBeenCalled();
    });

    test("returns 400 when status is missing from the request body", async () => {
      const res = await request(app)
        .patch("/api/applications/1/status")
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid status/i);
      expect(jobQueries.updateGigApplicationStatus).not.toHaveBeenCalled();
    });

    test("returns 400 when status is APPLIED (not an allowed transition)", async () => {
      const res = await request(app)
        .patch("/api/applications/1/status")
        .send({ status: "APPLIED" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid status/i);
      expect(jobQueries.updateGigApplicationStatus).not.toHaveBeenCalled();
    });

    test("returns 400 when status is an arbitrary unknown value", async () => {
      const res = await request(app)
        .patch("/api/applications/1/status")
        .send({ status: "HIRED" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid status/i);
    });

    // ── Not found ──────────────────────────────────────────────────────────────

    test("returns 404 when the application does not exist", async () => {
      jobQueries.updateGigApplicationStatus.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/applications/999/status")
        .send({ status: "REJECTED" });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Application not found");
    });

    // ── Successful non-ACCEPTED transitions ───────────────────────────────────

    test("returns 200 and updated application when status is IN_REVIEW", async () => {
      const updatedApplication = {
        application_id: 1,
        job_id: 10,
        employer_id: 100,
        worker_profile_id: 200,
        status: "IN_REVIEW",
      };
      jobQueries.updateGigApplicationStatus.mockResolvedValueOnce(updatedApplication);

      const res = await request(app)
        .patch("/api/applications/1/status")
        .send({ status: "IN_REVIEW" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Application status updated");
      expect(res.body.application.status).toBe("IN_REVIEW");
    });

    test("returns 200 and updated application when status is REJECTED", async () => {
      const updatedApplication = {
        application_id: 1,
        job_id: 10,
        employer_id: 100,
        worker_profile_id: 200,
        status: "REJECTED",
      };
      jobQueries.updateGigApplicationStatus.mockResolvedValueOnce(updatedApplication);

      const res = await request(app)
        .patch("/api/applications/1/status")
        .send({ status: "REJECTED" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Application status updated");
      expect(res.body.application.status).toBe("REJECTED");
    });

    test("returns 200 and updated application when status is WITHDRAWN", async () => {
      const updatedApplication = {
        application_id: 1,
        job_id: 10,
        employer_id: 100,
        worker_profile_id: 200,
        status: "WITHDRAWN",
      };
      jobQueries.updateGigApplicationStatus.mockResolvedValueOnce(updatedApplication);

      const res = await request(app)
        .patch("/api/applications/1/status")
        .send({ status: "WITHDRAWN" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Application status updated");
      expect(res.body.application.status).toBe("WITHDRAWN");
    });

    // ── Notification is NOT sent for non-ACCEPTED transitions ─────────────────

    test("does NOT send a notification when status is IN_REVIEW", async () => {
      jobQueries.updateGigApplicationStatus.mockResolvedValueOnce({
        application_id: 1, job_id: 10, employer_id: 100, worker_profile_id: 200, status: "IN_REVIEW",
      });

      await request(app).patch("/api/applications/1/status").send({ status: "IN_REVIEW" });

      expect(userQueries.insertNotification).not.toHaveBeenCalled();
    });

    test("does NOT send a notification when status is REJECTED", async () => {
      jobQueries.updateGigApplicationStatus.mockResolvedValueOnce({
        application_id: 1, job_id: 10, employer_id: 100, worker_profile_id: 200, status: "REJECTED",
      });

      await request(app).patch("/api/applications/1/status").send({ status: "REJECTED" });

      expect(userQueries.insertNotification).not.toHaveBeenCalled();
    });

    test("does NOT send a notification when status is WITHDRAWN", async () => {
      jobQueries.updateGigApplicationStatus.mockResolvedValueOnce({
        application_id: 1, job_id: 10, employer_id: 100, worker_profile_id: 200, status: "WITHDRAWN",
      });

      await request(app).patch("/api/applications/1/status").send({ status: "WITHDRAWN" });

      expect(userQueries.insertNotification).not.toHaveBeenCalled();
    });

    // ── Database error ─────────────────────────────────────────────────────────

    test("returns 500 when the database throws an error", async () => {
      jobQueries.updateGigApplicationStatus.mockRejectedValueOnce(new Error("DB connection lost"));

      const res = await request(app)
        .patch("/api/applications/1/status")
        .send({ status: "REJECTED" });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Error updating application status");
      expect(res.body.error).toBe("DB connection lost");
    });
  });
});
