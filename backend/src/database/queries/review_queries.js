// backend/src/database/queries/review_queries.js
const db = require("../connection");

// create a review (rating and/or review_text optional)
async function createReview({ reviewer_id, reviewee_id, rating = null, review_text = null }) {
  const result = await db.query(
    `INSERT INTO reviews (reviewer_id, reviewee_id, rating, review_text)
     VALUES ($1, $2, $3, $4)
     RETURNING *;`,
    [reviewer_id, reviewee_id, rating, review_text]
  );
  return result.rows[0];
}

// get reviews received by a user, newest first
async function getReviewsForUser(reviewee_id) {
  const result = await db.query(
    `SELECT r.id, r.reviewer_id, r.reviewee_id, r.rating, r.review_text, r.created_at,
            u.email AS reviewer_email,
            w.first_name AS reviewer_first_name,
            w.last_name AS reviewer_last_name,
            b.business_name AS reviewer_business_name
     FROM reviews r
     JOIN users u ON u.id = r.reviewer_id
     LEFT JOIN workers w ON w.user_id = u.id
     LEFT JOIN businesses b ON b.user_id = u.id
     WHERE r.reviewee_id = $1
     ORDER BY r.created_at DESC;`,
    [reviewee_id]
  );
  return result.rows;
}

// get avg rating + count (ignores NULLs automatically)
async function getReviewSummaryForUser(reviewee_id) {
  const result = await db.query(
    `SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating,
            COUNT(rating) FILTER (WHERE rating IS NOT NULL)::int AS ratings_count,
            COUNT(*)::int AS total_reviews
     FROM reviews
     WHERE reviewee_id = $1;`,
    [reviewee_id]
  );
  return result.rows[0];
}

module.exports = {
  createReview,
  getReviewsForUser,
  getReviewSummaryForUser,
};