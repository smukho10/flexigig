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

// ── FIX: added getProfileByWorkerId, deleteWorkerProfile, updateWorkerProfileById ──
jest.mock("../../src/database/queries/profile_queries.js", () => ({
  listWorkerProfiles: jest.fn(),
  createWorkerProfile: jest.fn(),
  getProfileByWorkerId: jest.fn(),
  deleteWorkerProfile: jest.fn(),
  updateWorkerProfileById: jest.fn(),
  checkWorkerProfile: jest.fn(),
  addUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  checkBusinessProfile: jest.fn(),
  addBusinessProfile: jest.fn(),
  updateBusinessProfile: jest.fn(),
  getProfile: jest.fn(),
  getBusinessProfile: jest.fn(),
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
jest.mock("../../src/config/r2", () => ({
  send: jest.fn(),
}));

// Mock @aws-sdk/client-s3
jest.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
  GetObjectCommand: jest.fn().mockImplementation((params) => params),
  HeadObjectCommand: jest.fn().mockImplementation((params) => params),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => params),
  S3Client: jest.fn(),
}));

// Mock @aws-sdk/s3-request-presigner
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://fake-signed-url.example.com/upload"),
}));

const s3 = require("../../src/config/r2");

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

describe("Resume Upload API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── POST /api/profile/upload-resume-url/:workerId ───

  describe("POST /api/profile/upload-resume-url/:workerId", () => {
    test("returns signed upload URL for PDF content type", async () => {
      // getSignedUrl mock default resolves to upload URL
      const res = await request(app)
        .post("/api/profile/upload-resume-url/7")
        .send({ contentType: "application/pdf" });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("uploadUrl");
      expect(res.body).toHaveProperty("key");
      expect(res.body.key).toMatch(/^workers\/7\/resume.*\.pdf$/);
      expect(getSignedUrl).toHaveBeenCalledTimes(1);
    });

    test("returns 400 when contentType is not PDF", async () => {
      const res = await request(app)
        .post("/api/profile/upload-resume-url/7")
        .send({ contentType: "image/jpeg" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Only PDF files are allowed");
    });

    test("returns 400 when contentType is missing", async () => {
      const res = await request(app)
        .post("/api/profile/upload-resume-url/7")
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Only PDF files are allowed");
    });

    test("returns 500 when getSignedUrl fails", async () => {
      getSignedUrl.mockRejectedValueOnce(new Error("R2 error"));

      const res = await request(app)
        .post("/api/profile/upload-resume-url/7")
        .send({ contentType: "application/pdf" });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to generate resume upload URL");
    });
  });

  // ─── POST /api/profile/save-resume-key/:workerId ───

  describe("POST /api/profile/save-resume-key/:workerId", () => {
    test("saves resume key successfully", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post("/api/profile/save-resume-key/7")
        .send({ key: "workers/7/resume-abc.pdf" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Resume saved");
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE workers SET resume_key"),
        ["workers/7/resume-abc.pdf", "7"]
      );
    });

    test("returns 400 when key is missing", async () => {
      const res = await request(app)
        .post("/api/profile/save-resume-key/7")
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Key is required");
    });

    test("returns 500 when db.query fails", async () => {
      db.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app)
        .post("/api/profile/save-resume-key/7")
        .send({ key: "workers/7/resume-abc.pdf" });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to save resume key");
    });
  });

  // ─── GET /api/profile/view-resume-url/:workerId ───

  describe("GET /api/profile/view-resume-url/:workerId", () => {
test("returns signed view URL when resume exists", async () => {
  db.query.mockResolvedValueOnce({
    rows: [{ resume_key: "workers/7/resume-abc.pdf" }],
  });
  s3.send.mockResolvedValueOnce({}); // HeadObject check passes

  const res = await request(app).get("/api/profile/view-resume-url/7");

  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty("viewUrl");
  expect(getSignedUrl).toHaveBeenCalledTimes(1);
});

    test("returns 404 when no resume is stored", async () => {
      db.query.mockResolvedValueOnce({ rows: [{ resume_key: null }] });

      const res = await request(app).get("/api/profile/view-resume-url/7");

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("No resume found");
    });

    test("returns 404 when worker does not exist", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/api/profile/view-resume-url/999");

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("No resume found");
    });

    test("returns 500 when db.query fails", async () => {
      db.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).get("/api/profile/view-resume-url/7");

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to generate resume view URL");
    });

test("returns 500 when getSignedUrl fails", async () => {
  db.query.mockResolvedValueOnce({
    rows: [{ resume_key: "workers/7/resume-abc.pdf" }],
  });
  s3.send.mockResolvedValueOnce({}); // HeadObject check passes
  getSignedUrl.mockRejectedValueOnce(new Error("R2 error"));

  const res = await request(app).get("/api/profile/view-resume-url/7");

  expect(res.statusCode).toBe(500);
  expect(res.body.message).toBe("Failed to generate resume view URL");
});
  });

  // ─── DELETE /api/profile/delete-resume/:workerId ───

  describe("DELETE /api/profile/delete-resume/:workerId", () => {
    test("deletes resume successfully", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete("/api/profile/delete-resume/7");

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Resume deleted");
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE workers SET resume_key = NULL"),
        ["7"]
      );
    });

    test("returns 500 when db.query fails", async () => {
      db.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).delete("/api/profile/delete-resume/7");

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to delete resume");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Applicant Profile View API  (Task 9)
// ─────────────────────────────────────────────────────────────────────────────

describe("Applicant Profile View API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 400 for non-numeric workerId", async () => {
    const res = await request(app).get("/api/applicant-profile/abc");
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid workerId");
  });

  test("returns 404 when profile does not exist", async () => {
    profileQueries.getProfileByWorkerId.mockResolvedValueOnce(null);
    workers_queries.getWorkerSkillsWithId.mockResolvedValueOnce([]);
    workers_queries.getWorkerExperiencesWithId.mockResolvedValueOnce([]);

    const res = await request(app).get("/api/applicant-profile/999");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Applicant profile not found");
  });

  test("returns full applicant profile with skills and experiences", async () => {
    const mockProfile = { worker_id: 7, firstname: "Jane", lastname: "Doe" };
    const mockSkills = [{ skill_id: 1, skill_name: "Cooking" }];
    const mockExperiences = [{ experience_id: 1, experience_name: "Waitress" }];

    profileQueries.getProfileByWorkerId.mockResolvedValueOnce(mockProfile);
    workers_queries.getWorkerSkillsWithId.mockResolvedValueOnce(mockSkills);
    workers_queries.getWorkerExperiencesWithId.mockResolvedValueOnce(mockExperiences);

    const res = await request(app).get("/api/applicant-profile/7");

    expect(res.statusCode).toBe(200);
    expect(res.body.profile).toEqual(mockProfile);
    expect(res.body.skills).toEqual(mockSkills);
    expect(res.body.experiences).toEqual(mockExperiences);
  });

  test("returns 500 when query throws", async () => {
    profileQueries.getProfileByWorkerId.mockRejectedValueOnce(new Error("DB error"));
    workers_queries.getWorkerSkillsWithId.mockResolvedValueOnce([]);
    workers_queries.getWorkerExperiencesWithId.mockResolvedValueOnce([]);

    const res = await request(app).get("/api/applicant-profile/7");

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe("Internal server error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete Worker Profile API  (Task 9)
// ─────────────────────────────────────────────────────────────────────────────

describe("Delete Worker Profile API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 400 for non-numeric workerId", async () => {
    const res = await request(app).delete("/api/profile/delete-worker-profile/abc");
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid worker ID");
  });

  test("returns 404 when worker row not found", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).delete("/api/profile/delete-worker-profile/99");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Profile not found");
  });

  test("returns 400 when trying to delete the last profile", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ user_id: 10 }] });
    profileQueries.listWorkerProfiles.mockResolvedValueOnce([{ id: 5 }]);

    const res = await request(app).delete("/api/profile/delete-worker-profile/5");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Cannot delete the last profile/i);
  });

  test("deletes profile successfully when multiple exist", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ user_id: 10 }] });
    profileQueries.listWorkerProfiles.mockResolvedValueOnce([{ id: 5 }, { id: 6 }]);
    profileQueries.deleteWorkerProfile.mockResolvedValueOnce({ id: 5, profile_name: "Waiter" });

    const res = await request(app).delete("/api/profile/delete-worker-profile/5");

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Profile deleted successfully");
    expect(res.body.deletedProfile).toEqual({ id: 5, profile_name: "Waiter" });
  });

  test("returns 500 when deleteWorkerProfile throws", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ user_id: 10 }] });
    profileQueries.listWorkerProfiles.mockResolvedValueOnce([{ id: 5 }, { id: 6 }]);
    profileQueries.deleteWorkerProfile.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).delete("/api/profile/delete-worker-profile/5");

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe("Internal Server Error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Worker Profile API  (Task 9)
// ─────────────────────────────────────────────────────────────────────────────

describe("Update Worker Profile API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 400 for non-numeric workerId", async () => {
    const res = await request(app)
      .put("/api/profile/update-worker-profile/notanumber")
      .send({ profile_name: "Chef" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid worker ID");
  });

  test("returns 404 when profile does not exist", async () => {
    profileQueries.updateWorkerProfileById.mockResolvedValueOnce(null);

    const res = await request(app)
      .put("/api/profile/update-worker-profile/5")
      .send({ profile_name: "Chef" });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Profile not found");
  });

  test("updates profile successfully", async () => {
    const updated = { id: 5, profile_name: "Chef", biography: "Loves cooking" };
    profileQueries.updateWorkerProfileById.mockResolvedValueOnce(updated);

    const res = await request(app)
      .put("/api/profile/update-worker-profile/5")
      .send({ profile_name: "Chef", biography: "Loves cooking" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Profile updated successfully");
    expect(res.body.profileData).toEqual(updated);
  });

  test("returns 500 when updateWorkerProfileById throws", async () => {
    profileQueries.updateWorkerProfileById.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .put("/api/profile/update-worker-profile/5")
      .send({ profile_name: "Chef" });

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe("Internal Server Error");
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Legacy Profile Routes
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/profile/worker-id/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns worker id for a user", async () => {
    profileQueries.checkWorkerProfile.mockResolvedValueOnce({ id: 5 });

    const res = await request(app).get("/api/profile/worker-id/1");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 5 });
  });
});

describe("POST /api/profile/update/:id — worker update", () => {
  beforeEach(() => jest.clearAllMocks());

  test("creates worker profile when none exists", async () => {
    profileQueries.checkWorkerProfile.mockResolvedValueOnce(null);
    profileQueries.addUserProfile.mockResolvedValueOnce({ id: 10, biography: "test" });

    const res = await request(app)
      .post("/api/profile/update/1")
      .send({ biography: "test" });

    expect(res.statusCode).toBe(200);
    expect(res.body.profileData).toBeDefined();
  });

  test("updates worker profile when one exists", async () => {
    profileQueries.checkWorkerProfile.mockResolvedValueOnce({ id: 10 });
    profileQueries.updateUserProfile.mockResolvedValueOnce({ id: 10, biography: "updated" });

    const res = await request(app)
      .post("/api/profile/update/1")
      .send({ biography: "updated" });

    expect(res.statusCode).toBe(200);
    expect(res.body.profileData).toBeDefined();
  });

  test("creates business profile when none exists", async () => {
    profileQueries.checkBusinessProfile.mockResolvedValueOnce(null);
    profileQueries.addBusinessProfile.mockResolvedValueOnce({ id: 20, business_name: "Acme" });

    const res = await request(app)
      .post("/api/profile/update/1")
      .send({ business_name: "Acme" });

    expect(res.statusCode).toBe(200);
    expect(res.body.businessData).toBeDefined();
  });

  test("updates business profile when one exists", async () => {
    profileQueries.checkBusinessProfile.mockResolvedValueOnce({ id: 20 });
    profileQueries.updateBusinessProfile.mockResolvedValueOnce({ id: 20, business_name: "Acme 2" });

    const res = await request(app)
      .post("/api/profile/update/1")
      .send({ business_name: "Acme 2" });

    expect(res.statusCode).toBe(200);
    expect(res.body.businessData).toBeDefined();
  });
});