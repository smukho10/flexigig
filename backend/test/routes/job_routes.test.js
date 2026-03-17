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
});
