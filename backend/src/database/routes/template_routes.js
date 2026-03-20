// backend/src/database/routes/template_routes.js
const express = require("express");
const router = express.Router();
const template_queries = require("../queries/template_queries.js");

// GET /api/templates — fetch all templates for the logged-in employer
router.get("/templates", async (req, res) => {
  const userId = req.session?.user_id;
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const templates = await template_queries.fetchTemplatesByUserId(userId);
    return res.json({ templates });
  } catch (err) {
    console.error("Failed to fetch templates:", err);
    return res.status(500).json({ message: "Failed to fetch templates", error: err.message });
  }
});

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
    requiredSkills,
    requiredExperience,
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
      required_skills:    requiredSkills,
      required_experience: requiredExperience,
    });

    return res.status(201).json({ message: "Template saved", template });
  } catch (err) {
    console.error("Failed to create template:", err);
    return res.status(500).json({ message: "Failed to save template", error: err.message });
  }
});

// PUT /api/templates/:id — update an existing template
router.put("/templates/:id", async (req, res) => {
  const userId = req.session?.user_id;
  if (!userId) return res.status(401).json({ message: "Not authenticated" });

  const templateId = parseInt(req.params.id, 10);
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
    requiredSkills,
    requiredExperience,
  } = req.body;

  if (!template_name?.trim()) {
    return res.status(400).json({ message: "Template name is required" });
  }

  try {
    const updated = await template_queries.updateTemplate(templateId, userId, {
      template_name:       template_name.trim(),
      job_title:           jobTitle,
      job_type:            jobType,
      job_description:     jobDescription,
      hourly_rate:         hourlyRate,
      street_address:      jobStreetAddress,
      city:                jobCity,
      province:            jobProvince,
      postal_code:         jobPostalCode,
      required_skills:     requiredSkills,
      required_experience: requiredExperience,
    });
    if (!updated) return res.status(404).json({ message: "Template not found" });
    return res.json({ message: "Template updated", template: updated });
  } catch (err) {
    console.error("Failed to update template:", err);
    return res.status(500).json({ message: "Failed to update template", error: err.message });
  }
});

// DELETE /api/templates/:id — delete a template
router.delete("/templates/:id", async (req, res) => {
  const userId = req.session?.user_id;
  if (!userId) return res.status(401).json({ message: "Not authenticated" });

  const templateId = parseInt(req.params.id, 10);
  try {
    const deleted = await template_queries.deleteTemplate(templateId, userId);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    return res.json({ message: "Template deleted" });
  } catch (err) {
    console.error("Failed to delete template:", err);
    return res.status(500).json({ message: "Failed to delete template", error: err.message });
  }
});

module.exports = router;
