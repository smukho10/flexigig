process.env.SENDGRID_API_KEY = "test_key";
process.env.EMAIL_FROM = "test@example.com";
process.env.FRONTEND_URL = "http://localhost:3000";

const request = require("supertest");
const app = require("../../src/app");

// Mock DB connection
jest.mock("../../src/database/connection.js", () => ({
  query: jest.fn(),
}));

// Mock workers_queries
jest.mock("../../src/database/queries/workers_queries.js", () => ({
  fetchWorkers: jest.fn(),
  getAllSkills: jest.fn(),
  getAllExperiences: jest.fn(),
  getAllTraits: jest.fn(),
  addWorkerSkill: jest.fn(),
  clearWorkerSkills: jest.fn(),
  clearWorkerTraits: jest.fn(),
  clearWorkerExperiences: jest.fn(),
  getWorkerSkills: jest.fn(),
  getWorkerSkillsWithId: jest.fn(),
  addWorkerExperience: jest.fn(),
  getWorkerExperiences: jest.fn(),
  getWorkerExperiencesWithId: jest.fn(),
  addWorkerTrait: jest.fn(),
  getWorkerTraits: jest.fn(),
  getWorkerTraitsWithId: jest.fn(),
}));

// Mount the workers routes on the app
const workersRouter = require("../../src/database/routes/workers_routes");
app.use("/api", workersRouter);

const workers_queries = require("../../src/database/queries/workers_queries.js");

describe("Skills Addition API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/get-all-skills ───

  describe("GET /api/get-all-skills", () => {
    test("returns all skills successfully", async () => {
      const mockSkills = [
        { skill_id: 1, skill_name: "JavaScript" },
        { skill_id: 2, skill_name: "Python" },
        { skill_id: 3, skill_name: "React" },
      ];
      workers_queries.getAllSkills.mockResolvedValueOnce(mockSkills);

      const res = await request(app).get("/api/get-all-skills");

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockSkills);
      expect(res.body).toHaveLength(3);
      expect(workers_queries.getAllSkills).toHaveBeenCalledTimes(1);
    });

    test("returns empty array when no skills exist", async () => {
      workers_queries.getAllSkills.mockResolvedValueOnce([]);

      const res = await request(app).get("/api/get-all-skills");

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });

    test("returns 500 when query fails", async () => {
      workers_queries.getAllSkills.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).get("/api/get-all-skills");

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe("Internal server error");
    });
  });

  // ─── POST /api/add-worker-skill-ids/:workid/:skillid ───

  describe("POST /api/add-worker-skill-ids/:workid/:skillid", () => {
    test("adds a skill to a worker successfully", async () => {
      workers_queries.addWorkerSkill.mockResolvedValueOnce({
        workers_id: 1,
        skill_id: 5,
      });

      const res = await request(app).post("/api/add-worker-skill-ids/1/5");

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Skill Added");
      expect(workers_queries.addWorkerSkill).toHaveBeenCalledWith("1", "5");
    });

    test("returns 500 when addWorkerSkill fails", async () => {
      workers_queries.addWorkerSkill.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).post("/api/add-worker-skill-ids/1/5");

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe("Internal server error");
    });
  });

  // ─── POST /api/clear-worker-skills/:id ───

  describe("POST /api/clear-worker-skills/:id", () => {
    test("clears all skills for a worker successfully", async () => {
      workers_queries.clearWorkerSkills.mockResolvedValueOnce({ rowCount: 3 });

      const res = await request(app).post("/api/clear-worker-skills/1");

      expect(res.statusCode).toBe(200);
      expect(workers_queries.clearWorkerSkills).toHaveBeenCalledWith("1");
    });
  });

  // ─── GET /api/get-worker-skills-id/:id ───

  describe("GET /api/get-worker-skills-id/:id", () => {
    test("returns skills for a specific worker", async () => {
      const mockSkills = [
        { skill_id: 1, skill_name: "JavaScript" },
        { skill_id: 3, skill_name: "React" },
      ];
      workers_queries.getWorkerSkillsWithId.mockResolvedValueOnce(mockSkills);

      const res = await request(app).get("/api/get-worker-skills-id/1");

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockSkills);
      expect(res.body).toHaveLength(2);
      expect(workers_queries.getWorkerSkillsWithId).toHaveBeenCalledWith("1");
    });

    test("returns empty array when worker has no skills", async () => {
      workers_queries.getWorkerSkillsWithId.mockResolvedValueOnce([]);

      const res = await request(app).get("/api/get-worker-skills-id/1");

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
