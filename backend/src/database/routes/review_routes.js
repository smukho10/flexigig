// backend/src/database/routes/review_routes.js
const express = require("express");
const router = express.Router();
const reviewQueries = require("../queries/review_queries");
const db = require("../connection");

// POST /api/reviews
// body: { reviewer_id, reviewee_id, rating?, review_text? }
router.post("/reviews", async (req, res) => {
  try {
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

    let rating = null;
    if (ratingRaw !== undefined && ratingRaw !== null && ratingRaw !== "") {
      const parsed = parseInt(ratingRaw, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 5) {
        return res.status(400).json({ message: "Rating must be an integer between 1 and 5." });
      }
      rating = parsed;
    }

    if (rating === null && (!review_text || review_text.length === 0)) {
      return res.status(400).json({ message: "Provide rating or review_text (or both)." });
    }

    const check = await db.query(
      `SELECT id FROM users WHERE id = ANY($1::int[])`,
      [[reviewer_id, reviewee_id]]
    );
    if (check.rows.length < 2) {
      return res.status(400).json({ message: "Reviewer or reviewee does not exist." });
    }

    const created = await reviewQueries.createReview({
      reviewer_id,
      reviewee_id,
      rating,
      review_text: review_text ?? null,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("Error creating review:", err);
    if (err && (err.code === "23505" || (err.constraint && err.constraint === "unique_reviewer_reviewee"))) {
      return res.status(400).json({ message: "You have already reviewed this user." });
    }
    if (err && err.code === "23514") {
      return res.status(400).json({ message: "Invalid input per database constraints." });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

// NEW: POST /api/reviews/employer-to-worker
// body: { reviewer_id, reviewee_id, job_id, rating?, review_text? }
router.post("/reviews/employer-to-worker", async (req, res) => {
  try {
    const reviewer_id = req.body.reviewer_id ? parseInt(req.body.reviewer_id, 10) : null;
    const reviewee_id = req.body.reviewee_id ? parseInt(req.body.reviewee_id, 10) : null;
    const job_id = req.body.job_id ? parseInt(req.body.job_id, 10) : null;
    const ratingRaw = req.body.rating;
    const review_text = req.body.review_text ? String(req.body.review_text).trim() : null;

    if (!reviewer_id || !reviewee_id || !job_id) {
      return res.status(400).json({ message: "reviewer_id, reviewee_id, and job_id are required." });
    }
    if (Number.isNaN(reviewer_id) || Number.isNaN(reviewee_id) || Number.isNaN(job_id)) {
      return res.status(400).json({ message: "Invalid reviewer_id, reviewee_id, or job_id." });
    }
    if (reviewer_id === reviewee_id) {
      return res.status(400).json({ message: "You cannot review yourself." });
    }

    let rating = null;
    if (ratingRaw !== undefined && ratingRaw !== null && ratingRaw !== "") {
      const parsed = parseInt(ratingRaw, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 5) {
        return res.status(400).json({ message: "Rating must be an integer between 1 and 5." });
      }
      rating = parsed;
    }

    if (rating === null && (!review_text || review_text.length === 0)) {
      return res.status(400).json({ message: "Provide rating or review_text (or both)." });
    }

    // Validate that:
    // 1) reviewer is the employer who owns the job
    // 2) reviewee is the worker user tied to the ACCEPTED application
    // 3) job is completed
    const validation = await db.query(
      `
      SELECT ga.application_id
      FROM gig_applications ga
      JOIN workers w ON ga.worker_profile_id = w.id
      JOIN jobPostings jp ON jp.job_id = ga.job_id
      WHERE ga.job_id = $1
        AND jp.user_id = $2
        AND w.user_id = $3
        AND ga.status = 'ACCEPTED'
        AND jp.status = 'completed'
      LIMIT 1
      `,
      [job_id, reviewer_id, reviewee_id]
    );

    if (validation.rows.length === 0) {
      return res.status(403).json({
        message: "Employer can review worker only after the accepted gig is completed."
      });
    }

    const created = await reviewQueries.createReview({
      reviewer_id,
      reviewee_id,
      rating,
      review_text: review_text ?? null,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("Error creating employer-to-worker review:", err);
    if (err && (err.code === "23505" || (err.constraint && err.constraint === "unique_reviewer_reviewee"))) {
      return res.status(400).json({ message: "You have already reviewed this user." });
    }
    if (err && err.code === "23514") {
      return res.status(400).json({ message: "Invalid input per database constraints." });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reviews/:userId
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

// GET /api/reviews/:userId/summary
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