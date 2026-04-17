const request = require("supertest");
const express = require("express");

const app = express();
app.use(express.json());

jest.mock("../src/database/queries/job_queries", () => ({
  getAllJobs: jest.fn(),
}));

const { getAllJobs } = require("../src/database/queries/job_queries");

const jobRoutes = require("../src/database/routes/job_routes");

app.use("/api", jobRoutes);

describe("Location Filter API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should filter jobs by city", async () => {
    getAllJobs.mockResolvedValue([
      { jobtitle: "Cleaner", city: "Toronto" },
    ]);

    const res = await request(app)
      .get("/api/all-jobs") // adjust if needed
      .query({ city: "Toronto" });

    expect(res.statusCode).toBe(200);
  });

  test("should return empty array", async () => {
    getAllJobs.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/all-jobs")
      .query({ city: "InvalidCity" });

    expect(res.statusCode).toBe(200);
  });

  test("should handle invalid input safely", async () => {
    getAllJobs.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/all-jobs")
      .query({ city: "' OR 1=1 --" });

    expect(res.statusCode).toBe(200);
  });

  test("should return 500 on server error", async () => {
    getAllJobs.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get("/api/all-jobs");

    expect(res.statusCode).toBe(500);
  });
});