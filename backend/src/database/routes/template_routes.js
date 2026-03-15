// backend/src/database/routes/template_routes.js
const express = require("express");
const router = express.Router();
const template_queries = require("../queries/template_queries.js");

// POST /api/templates — save the current form state as a named template
router.post("/templates", async (req, res) => {
  const userId = req.session?.user_id;
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const {
    template_name,
    jobTitle,
    jobType,
    jobDescription,
    hourlyRate,
    jobStreetAddress,
    jobCity,
    jobProvince,
    jobPostalCode,
  } = req.body;

  if (!template_name?.trim()) {
    return res.status(400).json({ message: "Template name is required" });
  }

  try {
    const count = await template_queries.getTemplateCountByUserId(userId);
    if (count >= template_queries.TEMPLATE_LIMIT) {
      return res.status(409).json({
        message: `You can only save up to ${template_queries.TEMPLATE_LIMIT} templates.`,
      });
    }

    const template = await template_queries.createTemplate({
      user_id:        userId,
      template_name:  template_name.trim(),
      job_title:      jobTitle,
      job_type:       jobType,
      job_description: jobDescription,
      hourly_rate:    hourlyRate,
      street_address: jobStreetAddress,
      city:           jobCity,
      province:       jobProvince,
      postal_code:    jobPostalCode,
    });

    return res.status(201).json({ message: "Template saved", template });
  } catch (err) {
    console.error("Failed to create template:", err);
    return res.status(500).json({ message: "Failed to save template", error: err.message });
  }
});

module.exports = router;
