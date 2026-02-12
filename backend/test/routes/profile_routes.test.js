process.env.SENDGRID_API_KEY = "test_key";
process.env.EMAIL_FROM = "test@example.com";
process.env.FRONTEND_URL = "http://localhost:3000";


const request = require("supertest");
const app = require("../../src/app");

// Mock DB + queries so tests don’t require real Postgres
jest.mock("../../src/database/connection.js", () => ({
  query: jest.fn()
}));

jest.mock("../../src/database/queries/profile_queries.js", () => ({
  listWorkerProfiles: jest.fn(),
  createWorkerProfile: jest.fn()
}));

const db = require("../../src/database/connection.js");
const profileQueries = require("../../src/database/queries/profile_queries.js");

describe("Worker profiles API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("blocks employer from listing profiles", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ isbusiness: true }] });

    const res = await request(app).get("/api/profile/worker-profiles/123");
    expect(res.statusCode).toBe(403);
  });

  test("creates profile but blocks when >= 3", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ isbusiness: false }] }); // user is worker
    profileQueries.listWorkerProfiles.mockResolvedValueOnce([{},{},{}]);

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
      id: 55, user_id: 123, profile_name: "Waiter"
    });

    const res = await request(app)
      .post("/api/profile/create-worker-profile/123")
      .send({ profileName: "Waiter" });

    expect(res.statusCode).toBe(201);
    expect(res.body.profile_name).toBe("Waiter");
  });
});