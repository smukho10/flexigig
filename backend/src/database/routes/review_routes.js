// backend/src/database/routes/review_routes.js
const express = require("express");
const router = express.Router();
const reviewQueries = require("../queries/review_queries");
const db = require("../connection");

// POST /api/reviews
// body: { reviewer_id, reviewee_id, rating?, review_text? }
router.post("/reviews", async (req, res) => {
  try {
    // parse & normalize incoming values
    const reviewer_id = req.body.reviewer_id ? parseInt(req.body.reviewer_id, 10) : null;
    const reviewee_id = req.body.reviewee_id ? parseInt(req.body.reviewee_id, 10) : null;
    const ratingRaw = req.body.rating;
    const review_text = req.body.review_text ? String(req.body.review_text).trim() : null;

    if (!reviewer_id || !reviewee_id) {
      return res.status(400).json({ message: "reviewer_id and reviewee_id are required and must be integers." });
    }
    if (Number.isNaN(reviewer_id) || Number.isNaN(reviewee_id)) {
      return res.status(400).json({ message: "Invalid reviewer_id or reviewee_id." });
    }
    if (reviewer_id === reviewee_id) {
      return res.status(400).json({ message: "You cannot review yourself." });
    }

    // rating validation (optional)
    let rating = null;
    if (ratingRaw !== undefined && ratingRaw !== null && ratingRaw !== "") {
      // allow strings that contain numbers as well
      const parsed = parseInt(ratingRaw, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 5) {
        return res.status(400).json({ message: "Rating must be an integer between 1 and 5." });
      }
      rating = parsed;
    }

    // require at least one of rating or review_text (mirrors DB constraint)
    if (rating === null && (!review_text || review_text.length === 0)) {
      return res.status(400).json({ message: "Provide rating or review_text (or both)." });
    }

    // confirm users exist
    const check = await db.query(
      `SELECT id FROM users WHERE id = ANY($1::int[])`,
      [[reviewer_id, reviewee_id]]
    );
    if (check.rows.length < 2) {
      return res.status(400).json({ message: "Reviewer or reviewee does not exist." });
    }

    // create
    const created = await reviewQueries.createReview({
      reviewer_id,
      reviewee_id,
      rating,
      review_text: review_text ?? null,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("Error creating review:", err);
    // unique violation (Postgres)
    if (err && (err.code === "23505" || (err.constraint && err.constraint === "unique_reviewer_reviewee"))) {
      return res.status(400).json({ message: "You have already reviewed this user." });
    }
    // check violation for at_least_one_field or no_self_review could also come back as 23514 / 23514 etc.
    if (err && err.code === "23514") {
      return res.status(400).json({ message: "Invalid input per database constraints." });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reviews/:userId  -> list reviews received by user
router.get("/reviews/:userId", async (req, res) => {
  try {
    const reviewee_id = parseInt(req.params.userId, 10);
    if (Number.isNaN(reviewee_id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const rows = await reviewQueries.getReviewsForUser(reviewee_id);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching reviews:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reviews/:userId/summary -> avg + count
router.get("/reviews/:userId/summary", async (req, res) => {
  try {
    const reviewee_id = parseInt(req.params.userId, 10);
    if (Number.isNaN(reviewee_id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const summary = await reviewQueries.getReviewSummaryForUser(reviewee_id);
    return res.json(summary);
  } catch (err) {
    console.error("Error fetching review summary:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;