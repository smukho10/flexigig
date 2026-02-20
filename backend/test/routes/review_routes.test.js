process.env.SENDGRID_API_KEY = "test_key";
process.env.EMAIL_FROM = "test@example.com";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.NODE_ENV = "test";

jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

jest.mock("../../src/database/connection.js", () => ({
  query: jest.fn(),
}));

jest.mock("../../src/database/queries/review_queries.js", () => ({
  createReview:             jest.fn(),
  getReviewsForUser:        jest.fn(),
  getReviewSummaryForUser:  jest.fn(),
}));

const request       = require("supertest");
const app           = require("../../src/app");
const db            = require("../../src/database/connection.js");
const reviewQueries = require("../../src/database/queries/review_queries.js");

const reviewRouter = require("../../src/database/routes/review_routes.js");
app.use("/api", reviewRouter);

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/reviews
// ══════════════════════════════════════════════════════════════════════════════
describe("POST /api/reviews", () => {
  beforeEach(() => jest.clearAllMocks());

  test("400 when reviewer_id is missing", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewee_id: 2, rating: 4 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/reviewer_id and reviewee_id are required/i);
    expect(reviewQueries.createReview).not.toHaveBeenCalled();
  });

  test("400 when reviewee_id is missing", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, rating: 4 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/reviewer_id and reviewee_id are required/i);
    expect(reviewQueries.createReview).not.toHaveBeenCalled();
  });

  test("400 when reviewer and reviewee are the same user (self-review)", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 5, reviewee_id: 5, rating: 3 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/cannot review yourself/i);
    expect(reviewQueries.createReview).not.toHaveBeenCalled();
  });

  test("400 when rating is out of range (0 is invalid)", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, reviewee_id: 2, rating: 0 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/rating must be an integer between 1 and 5/i);
  });

  test("400 when rating is out of range (6 is invalid)", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, reviewee_id: 2, rating: 6 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/rating must be an integer between 1 and 5/i);
  });

  test("400 when both rating and review_text are empty", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, reviewee_id: 2 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/provide rating or review_text/i);
  });

  test("400 when reviewer or reviewee does not exist in users table", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // only 1 user found, not 2

    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, reviewee_id: 999, rating: 4 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/does not exist/i);
    expect(reviewQueries.createReview).not.toHaveBeenCalled();
  });

  test("201 + returns created review with rating only", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    reviewQueries.createReview.mockResolvedValueOnce({
      id: 10, reviewer_id: 1, reviewee_id: 2,
      rating: 5, review_text: null, created_at: "2025-01-01T00:00:00.000Z",
    });

    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, reviewee_id: 2, rating: 5 });

    expect(res.statusCode).toBe(201);
    expect(res.body.rating).toBe(5);
    expect(res.body.review_text).toBeNull();
    expect(reviewQueries.createReview).toHaveBeenCalledWith({
      reviewer_id: 1, reviewee_id: 2, rating: 5, review_text: null,
    });
  });

  test("201 + returns created review with review_text only", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    reviewQueries.createReview.mockResolvedValueOnce({
      id: 11, reviewer_id: 1, reviewee_id: 2,
      rating: null, review_text: "Great employer!", created_at: "2025-01-01T00:00:00.000Z",
    });

    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, reviewee_id: 2, review_text: "Great employer!" });

    expect(res.statusCode).toBe(201);
    expect(res.body.rating).toBeNull();
    expect(res.body.review_text).toBe("Great employer!");
  });

  test("201 + returns created review with both rating and review_text", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    reviewQueries.createReview.mockResolvedValueOnce({
      id: 12, reviewer_id: 1, reviewee_id: 2,
      rating: 4, review_text: "Good experience", created_at: "2025-01-01T00:00:00.000Z",
    });

    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, reviewee_id: 2, rating: 4, review_text: "Good experience" });

    expect(res.statusCode).toBe(201);
    expect(res.body.rating).toBe(4);
    expect(res.body.review_text).toBe("Good experience");
  });

  test("400 when user tries to review same person twice (unique constraint)", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const dupError = new Error("duplicate key");
    dupError.code = "23505";
    dupError.constraint = "unique_reviewer_reviewee";
    reviewQueries.createReview.mockRejectedValueOnce(dupError);

    const res = await request(app)
      .post("/api/reviews")
      .send({ reviewer_id: 1, reviewee_id: 2, rating: 3 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already reviewed this user/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/reviews/:userId
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/reviews/:userId", () => {
  beforeEach(() => jest.clearAllMocks());

  test("400 when userId is not a number", async () => {
    const res = await request(app).get("/api/reviews/abc");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid user id/i);
    expect(reviewQueries.getReviewsForUser).not.toHaveBeenCalled();
  });

  test("200 + returns list of reviews for a user", async () => {
    reviewQueries.getReviewsForUser.mockResolvedValueOnce([
      {
        id: 1, reviewer_id: 3, reviewee_id: 7, rating: 5,
        review_text: "Excellent!", reviewer_email: "reviewer@example.com",
        reviewer_first_name: "Jane", reviewer_last_name: "Doe",
        reviewer_business_name: null,
      },
    ]);

    const res = await request(app).get("/api/reviews/7");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rating).toBe(5);
    expect(res.body[0].review_text).toBe("Excellent!");
    expect(reviewQueries.getReviewsForUser).toHaveBeenCalledWith(7);
  });

  test("200 + returns empty array when user has no reviews", async () => {
    reviewQueries.getReviewsForUser.mockResolvedValueOnce([]);

    const res = await request(app).get("/api/reviews/7");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/reviews/:userId/summary
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/reviews/:userId/summary", () => {
  beforeEach(() => jest.clearAllMocks());

  test("400 when userId is not a number", async () => {
    const res = await request(app).get("/api/reviews/abc/summary");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid user id/i);
    expect(reviewQueries.getReviewSummaryForUser).not.toHaveBeenCalled();
  });

  test("200 + returns avg rating and counts", async () => {
    reviewQueries.getReviewSummaryForUser.mockResolvedValueOnce({
      avg_rating: "4.50", ratings_count: 2, total_reviews: 3,
    });

    const res = await request(app).get("/api/reviews/7/summary");

    expect(res.statusCode).toBe(200);
    expect(res.body.avg_rating).toBe("4.50");
    expect(res.body.ratings_count).toBe(2);
    expect(res.body.total_reviews).toBe(3);
    expect(reviewQueries.getReviewSummaryForUser).toHaveBeenCalledWith(7);
  });

  test("200 + returns zeroes when user has no reviews", async () => {
    reviewQueries.getReviewSummaryForUser.mockResolvedValueOnce({
      avg_rating: "0", ratings_count: 0, total_reviews: 0,
    });

    const res = await request(app).get("/api/reviews/7/summary");

    expect(res.statusCode).toBe(200);
    expect(res.body.ratings_count).toBe(0);
    expect(res.body.total_reviews).toBe(0);
  });
});