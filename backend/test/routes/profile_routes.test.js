// ─── Environment Setup ───────────────────────────────────────────────────────
process.env.SENDGRID_API_KEY = "test_key";
process.env.EMAIL_FROM = "test@example.com";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.R2_BUCKET = "test-bucket";
process.env.R2_ENDPOINT = "https://fake.r2.endpoint";
process.env.R2_ACCESS_KEY_ID = "fake_key";
process.env.R2_SECRET_ACCESS_KEY = "fake_secret";
process.env.R2_SIGNED_URL_EXPIRY = "3600";

const request = require("supertest");
const app = require("../../src/app");

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock DB connection
jest.mock("../../src/database/connection.js", () => ({
  query: jest.fn(),
}));

// Mock profile queries
jest.mock("../../src/database/queries/profile_queries.js", () => ({
  listWorkerProfiles: jest.fn(),
  createWorkerProfile: jest.fn(),
}));

// Mock workers queries
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

// Mock the R2 S3 client
jest.mock("../../src/config/r2", () => ({}));

// Mock @aws-sdk/client-s3
jest.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
  GetObjectCommand: jest.fn().mockImplementation((params) => params),
  S3Client: jest.fn(),
}));

// Mock @aws-sdk/s3-request-presigner
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://fake-signed-url.example.com/upload"),
}));

// ─── Mount Routers ────────────────────────────────────────────────────────────

const profileRouter = require("../../src/database/routes/profile_routes");
app.use("/api", profileRouter);

const workersRouter = require("../../src/database/routes/workers_routes");
app.use("/api", workersRouter);

// ─── Require Mocked Modules ───────────────────────────────────────────────────

const db = require("../../src/database/connection.js");
const profileQueries = require("../../src/database/queries/profile_queries.js");
const workers_queries = require("../../src/database/queries/workers_queries.js");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// ─────────────────────────────────────────────────────────────────────────────
// Worker Profiles API
// ─────────────────────────────────────────────────────────────────────────────

describe("Worker profiles API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("blocks employer from listing profiles", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ isbusiness: true }] });

    const res = await request(app).get("/api/profile/worker-profiles/123");
    expect(res.statusCode).toBe(403);
  });

  test("creates profile but blocks when >= 3", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ isbusiness: false }] });
    profileQueries.listWorkerProfiles.mockResolvedValueOnce([{}, {}, {}]);

    const res = await request(app)
      .post("/api/profile/create-worker-profile/123")
      .send({ profileName: "Waiter" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Maximum 3 profiles/i);
  });

  test("creates profile when < 3", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ isbusiness: false }] });
    profileQueries.listWorkerProfiles.mockResolvedValueOnce([{}]);
    profileQueries.createWorkerProfile.mockResolvedValueOnce({
      id: 55,
      user_id: 123,
      profile_name: "Waiter",
    });

    const res = await request(app)
      .post("/api/profile/create-worker-profile/123")
      .send({ profileName: "Waiter" });

    expect(res.statusCode).toBe(201);
    expect(res.body.profile_name).toBe("Waiter");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Skills Addition API
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Profile Photo Upload API
// ─────────────────────────────────────────────────────────────────────────────

describe("Profile Photo Upload API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/profile/upload-photo-url/:userId ───

  describe("POST /api/profile/upload-photo-url/:userId", () => {
    test("returns signed upload URL for valid image content type", async () => {
      const res = await request(app)
        .post("/api/profile/upload-photo-url/1")
        .send({ contentType: "image/jpeg" });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("uploadUrl");
      expect(res.body).toHaveProperty("key");
      expect(res.body.uploadUrl).toBe("https://fake-signed-url.example.com/upload");
      expect(res.body.key).toMatch(/^users\/1\/profile-.+\.jpg$/);
      expect(getSignedUrl).toHaveBeenCalledTimes(1);
    });

    test("returns signed upload URL for image/png content type", async () => {
      const res = await request(app)
        .post("/api/profile/upload-photo-url/42")
        .send({ contentType: "image/png" });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("uploadUrl");
      expect(res.body.key).toMatch(/^users\/42\/profile-.+\.jpg$/);
    });

    test("returns 400 when contentType is missing", async () => {
      const res = await request(app)
        .post("/api/profile/upload-photo-url/1")
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid content type");
    });

    test("returns 400 when contentType is not an image", async () => {
      const res = await request(app)
        .post("/api/profile/upload-photo-url/1")
        .send({ contentType: "application/pdf" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid content type");
    });

    test("returns 400 when contentType is empty string", async () => {
      const res = await request(app)
        .post("/api/profile/upload-photo-url/1")
        .send({ contentType: "" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid content type");
    });

    test("returns 500 when getSignedUrl fails", async () => {
      getSignedUrl.mockRejectedValueOnce(new Error("R2 error"));

      const res = await request(app)
        .post("/api/profile/upload-photo-url/1")
        .send({ contentType: "image/jpeg" });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to generate upload URL");
    });
  });

  // ─── POST /api/profile/save-photo-key/:userId ───

  describe("POST /api/profile/save-photo-key/:userId", () => {
    test("saves photo key successfully", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post("/api/profile/save-photo-key/1")
        .send({ key: "users/1/profile-abc123.jpg" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Profile photo saved");
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET profile_photo_key"),
        ["users/1/profile-abc123.jpg", "1"]
      );
    });

    test("returns 400 when key is missing", async () => {
      const res = await request(app)
        .post("/api/profile/save-photo-key/1")
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Key is required");
    });

    test("returns 400 when key is empty string", async () => {
      const res = await request(app)
        .post("/api/profile/save-photo-key/1")
        .send({ key: "" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Key is required");
    });

    test("returns 500 when database query fails", async () => {
      db.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app)
        .post("/api/profile/save-photo-key/1")
        .send({ key: "users/1/profile-abc123.jpg" });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to save photo key");
    });
  });

  // ─── GET /api/profile/view-photo-url/:userId ───

  describe("GET /api/profile/view-photo-url/:userId", () => {
    test("returns signed view URL when photo exists", async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ profile_photo_key: "users/1/profile-abc123.jpg" }],
      });
      getSignedUrl.mockResolvedValueOnce("https://fake-signed-url.example.com/view");

      const res = await request(app).get("/api/profile/view-photo-url/1");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("viewUrl");
      expect(res.body.viewUrl).toBe("https://fake-signed-url.example.com/view");
      expect(getSignedUrl).toHaveBeenCalledTimes(1);
    });

    test("returns 404 when user has no profile photo", async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ profile_photo_key: null }],
      });

      const res = await request(app).get("/api/profile/view-photo-url/1");

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("No profile photo found");
    });

    test("returns 404 when user does not exist", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/api/profile/view-photo-url/999");

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("No profile photo found");
    });

    test("returns 500 when database query fails", async () => {
      db.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).get("/api/profile/view-photo-url/1");

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to generate view URL");
    });

    test("returns 500 when getSignedUrl fails", async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ profile_photo_key: "users/1/profile-abc123.jpg" }],
      });
      getSignedUrl.mockRejectedValueOnce(new Error("R2 error"));

      const res = await request(app).get("/api/profile/view-photo-url/1");

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to generate view URL");
    });
  });
});
