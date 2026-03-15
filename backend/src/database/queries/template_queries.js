// backend/src/database/queries/template_queries.js
const db = require("../connection.js");

const TEMPLATE_LIMIT = 10;

const getTemplateCountByUserId = async (userId) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM job_templates WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0].count;
};

const createTemplate = async ({
  user_id,
  template_name,
  job_title,
  job_type,
  job_description,
  hourly_rate,
  street_address,
  city,
  province,
  postal_code,
}) => {
  const result = await db.query(
    `
    INSERT INTO job_templates
      (user_id, template_name, job_title, job_type, job_description,
       hourly_rate, street_address, city, province, postal_code)
    VALUES ($1, $2, $3, $4, $5, $6::numeric, $7, $8, $9, $10)
    RETURNING *
    `,
    [
      user_id,
      template_name,
      job_title      || null,
      job_type       || null,
      job_description|| null,
      hourly_rate    || null,
      street_address || null,
      city           || null,
      province       || null,
      postal_code    || null,
    ]
  );
  return result.rows[0];
};

module.exports = {
  TEMPLATE_LIMIT,
  getTemplateCountByUserId,
  createTemplate,
};
