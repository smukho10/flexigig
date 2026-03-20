import React, { useState } from "react";
import axios from "axios";
import "../styles/SaveTemplateModal.css";

const SKILL_OPTIONS = [
  "French", "Communication", "Mandarin", "Cantonese",
  "Public Security", "Customer Service", "Food Safety Knowledge",
  "First Aid", "Business Management", "Inventory Management",
  "Delivery Driving", "Basic Carpentry",
];

const EXPERIENCE_OPTIONS = [
  "Event Staffing", "Hospitality Services", "Retail Assistance",
  "Delivery Services", "Maintenance and Repair", "Personal Services",
  "Construction and Renovation", "Healthcare Assistance",
  "Transportation Services", "Technical Support", "Cleaning Services",
  "Fitness Instruction", "Photography and Videography",
  "Creative Services", "Security Services",
];

const EditTemplateModal = ({ template, onClose, onSaved }) => {
  const [templateName,    setTemplateName]    = useState(template.template_name  || "");
  const [jobTitle,        setJobTitle]        = useState(template.job_title       || "");
  const [jobType,         setJobType]         = useState(template.job_type        || "");
  const [jobDescription,  setJobDescription]  = useState(template.job_description || "");
  const [hourlyRate,      setHourlyRate]      = useState(template.hourly_rate != null ? template.hourly_rate.toString() : "");
  const [streetAddress,   setStreetAddress]   = useState(template.street_address  || "");
  const [city,            setCity]            = useState(template.city            || "");
  const [province,        setProvince]        = useState(template.province        || "");
  const [postalCode,      setPostalCode]      = useState(template.postal_code     || "");
  const [requiredSkills,  setRequiredSkills]  = useState(Array.isArray(template.required_skills)     ? template.required_skills     : []);
  const [requiredExp,     setRequiredExp]     = useState(Array.isArray(template.required_experience) ? template.required_experience : []);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const toggleItem = (list, setList, item) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleSave = async () => {
    if (!templateName.trim()) { setError("Template name is required."); return; }
    setSaving(true); setError("");
    try {
      await axios.put(
        `/api/templates/${template.template_id}`,
        {
          template_name:      templateName.trim(),
          jobTitle,
          jobType,
          jobDescription,
          hourlyRate,
          jobStreetAddress:   streetAddress,
          jobCity:            city,
          jobProvince:        province,
          jobPostalCode:      postalCode,
          requiredSkills,
          requiredExperience: requiredExp,
        },
        { withCredentials: true }
      );
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update template.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="template-modal-overlay" onClick={onClose}>
      <div
        className="template-modal"
        style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3>Edit Template</h3>
        <p>Update the fields and save to overwrite this template.</p>

        <label>Template Name</label>
        <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} maxLength={100} autoFocus />

        <label>Job Title</label>
        <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />

        <label>Job Type</label>
        <input type="text" value={jobType} onChange={e => setJobType(e.target.value)} />

        <label>Hourly Rate ($)</label>
        <input type="number" min="0" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />

        <label>Street Address</label>
        <input type="text" value={streetAddress} onChange={e => setStreetAddress(e.target.value)} />

        <label>City</label>
        <input type="text" value={city} onChange={e => setCity(e.target.value)} />

        <label>Province</label>
        <select value={province} onChange={e => setProvince(e.target.value)}
          style={{ width: "100%", height: 38, padding: "0 12px", fontSize: 14, fontFamily: "Nunito", border: "1px solid #D0D5DD", borderRadius: 8, boxSizing: "border-box" }}>
          <option value="">Select</option>
          <option value="Alberta">AB</option>
          <option value="British Columbia">BC</option>
          <option value="Manitoba">MB</option>
          <option value="New Brunswick">NB</option>
          <option value="Newfoundland and Labrador">NL</option>
          <option value="Nova Scotia">NS</option>
          <option value="Ontario">ON</option>
          <option value="Prince Edward Island">PE</option>
          <option value="Quebec">QC</option>
          <option value="Saskatchewan">SK</option>
          <option value="Northwest Territories">NT</option>
          <option value="Nunavut">NU</option>
          <option value="Yukon">YT</option>
        </select>

        <label>Postal Code</label>
        <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} />

        <label>Job Description</label>
        <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
          style={{ width: "100%", height: 80, resize: "vertical", padding: 8, fontSize: 14, fontFamily: "Nunito", border: "1px solid #D0D5DD", borderRadius: 8, boxSizing: "border-box" }} />

        <label>Required Skills</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {SKILL_OPTIONS.map(s => (
            <span
              key={s}
              onClick={() => toggleItem(requiredSkills, setRequiredSkills, s)}
              style={{
                cursor: "pointer", padding: "3px 10px", borderRadius: 14, fontSize: 12,
                fontFamily: "Poppins", border: "1px solid #4EBBC2",
                backgroundColor: requiredSkills.includes(s) ? "#e0f5f5" : "#fff",
                color: requiredSkills.includes(s) ? "#2a9d9d" : "#374151",
              }}
            >{s}</span>
          ))}
        </div>

        <label>Required Experience</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {EXPERIENCE_OPTIONS.map(s => (
            <span
              key={s}
              onClick={() => toggleItem(requiredExp, setRequiredExp, s)}
              style={{
                cursor: "pointer", padding: "3px 10px", borderRadius: 14, fontSize: 12,
                fontFamily: "Poppins", border: "1px solid #4EBBC2",
                backgroundColor: requiredExp.includes(s) ? "#e0f5f5" : "#fff",
                color: requiredExp.includes(s) ? "#2a9d9d" : "#374151",
              }}
            >{s}</span>
          ))}
        </div>

        {error && <p className="template-modal-error">{error}</p>}

        <div className="template-modal-buttons" style={{ flexWrap: "nowrap" }}>
          <button className="template-modal-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="template-modal-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTemplateModal;