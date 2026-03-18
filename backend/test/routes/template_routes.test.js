process.env.NODE_ENV = "test";

const request  = require("supertest");
const express  = require("express");

// Mock the query layer before importing routes
jest.mock("../../src/database/queries/template_queries.js", () => ({
  TEMPLATE_LIMIT:             10,
  getTemplateCountByUserId:   jest.fn(),
  createTemplate:             jest.fn(),
  fetchTemplatesByUserId:     jest.fn(),
}));

const templateQueries = require("../../src/database/queries/template_queries.js");

// Mutable session object — each test reassigns this to control auth state
let mockSession = {};

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.session = mockSession; next(); });
app.use("/api", require("../../src/database/routes/template_routes.js"));

// ── Shared fixture ────────────────────────────────────────────────────────────
const sampleTemplate = {
  template_id:        1,
  template_name:      "Weekend Bartender",
  job_title:          "Bartender",
  job_type:           "Hospitality",
  job_description:    "Weekend bar shift",
  hourly_rate:        "25.00",
  street_address:     "123 King St",
  city:               "Toronto",
  province:           "Ontario",
  postal_code:        "M5V 2T6",
  required_skills:    ["Communication", "Customer Service"],
  required_experience:["Hospitality Services"],
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Template Routes — GET /api/templates (autofill data source)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = { user_id: 42 }; // authenticated by default
  });

  test("returns 200 and the templates array for an authenticated user", async () => {
    templateQueries.fetchTemplatesByUserId.mockResolvedValueOnce([sampleTemplate]);

    const res = await request(app).get("/api/templates");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("templates");
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates).toHaveLength(1);
    expect(res.body.templates[0].template_name).toBe("Weekend Bartender");
    expect(templateQueries.fetchTemplatesByUserId).toHaveBeenCalledWith(42);
    expect(templateQueries.fetchTemplatesByUserId).toHaveBeenCalledTimes(1);
  });

  test("returns all expected autofill fields on each template", async () => {
    templateQueries.fetchTemplatesByUserId.mockResolvedValueOnce([sampleTemplate]);

    const res = await request(app).get("/api/templates");
    const t   = res.body.templates[0];

    expect(t).toMatchObject({
      template_id:         1,
      template_name:       "Weekend Bartender",
      job_title:           "Bartender",
      job_type:            "Hospitality",
      job_description:     "Weekend bar shift",
      hourly_rate:         "25.00",
      street_address:      "123 King St",
      city:                "Toronto",
      province:            "Ontario",
      postal_code:         "M5V 2T6",
      required_skills:     ["Communication", "Customer Service"],
      required_experience: ["Hospitality Services"],
    });
  });

  test("returns an empty array when the user has no saved templates", async () => {
    templateQueries.fetchTemplatesByUserId.mockResolvedValueOnce([]);

    const res = await request(app).get("/api/templates");

    expect(res.statusCode).toBe(200);
    expect(res.body.templates).toEqual([]);
  });

  test("returns 401 when the request has no session / unauthenticated", async () => {
    mockSession = {}; // no user_id

    const res = await request(app).get("/api/templates");

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("message", "Not authenticated");
    expect(templateQueries.fetchTemplatesByUserId).not.toHaveBeenCalled();
  });

  test("returns 500 when the database query throws", async () => {
    templateQueries.fetchTemplatesByUserId.mockRejectedValueOnce(
      new Error("DB connection lost")
    );

    const res = await request(app).get("/api/templates");

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty("message", "Failed to fetch templates");
    expect(res.body).toHaveProperty("error", "DB connection lost");
  });
});
