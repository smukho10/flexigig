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
  required_skills,
  required_experience,
}) => {
  const result = await db.query(
    `
    INSERT INTO job_templates
      (user_id, template_name, job_title, job_type, job_description,
       hourly_rate, street_address, city, province, postal_code,
       required_skills, required_experience)
    VALUES ($1, $2, $3, $4, $5, $6::numeric, $7, $8, $9, $10, $11, $12)
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
      JSON.stringify(Array.isArray(required_skills)     ? required_skills     : []),
      JSON.stringify(Array.isArray(required_experience) ? required_experience : []),
    ]
  );
  return result.rows[0];
};
const updateTemplate = async (templateId, userId, {
  template_name,
  job_title,
  job_type,
  job_description,
  hourly_rate,
  street_address,
  city,
  province,
  postal_code,
  required_skills,
  required_experience,
}) => {
  const result = await db.query(
    `
    UPDATE job_templates
    SET
      template_name       = $1,
      job_title           = $2,
      job_type            = $3,
      job_description     = $4,
      hourly_rate         = $5::numeric,
      street_address      = $6,
      city                = $7,
      province            = $8,
      postal_code         = $9,
      required_skills     = $10,
      required_experience = $11,
      updated_at          = NOW()
    WHERE template_id = $12 AND user_id = $13
    RETURNING *
    `,
    [
      template_name,
      job_title       || null,
      job_type        || null,
      job_description || null,
      hourly_rate     || null,
      street_address  || null,
      city            || null,
      province        || null,
      postal_code     || null,
      JSON.stringify(Array.isArray(required_skills)     ? required_skills     : []),
      JSON.stringify(Array.isArray(required_experience) ? required_experience : []),
      templateId,
      userId,
    ]
  );
  return result.rows[0];
};

const deleteTemplate = async (templateId, userId) => {
  const result = await db.query(
    `DELETE FROM job_templates WHERE template_id = $1 AND user_id = $2 RETURNING *`,
    [templateId, userId]
  );
  return result.rows[0];
};

const fetchTemplatesByUserId = async (userId) => {
  const result = await db.query(
    `SELECT * FROM job_templates WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

module.exports = {
  TEMPLATE_LIMIT,
  getTemplateCountByUserId,
  createTemplate,
  fetchTemplatesByUserId,
  updateTemplate,
  deleteTemplate,
};
