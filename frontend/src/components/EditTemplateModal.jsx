import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../styles/SaveTemplateModal.css";

const SKILL_OPTIONS = [
  "French", "Communication", "Mandarin", "Cantonese",
  "Public Security", "Customer Service", "Food Safety Knowledge",
  "First Aid", "Business Management", "Inventory Management",
  "Delivery Driving", "Basic Carpentry",
];

const EXPERIENCE_OPTIONS = ["0-2 years", "3-5 years", "5+ years"];

// ── Reusable inline multi-select dropdown ─────────────────────────────────────
const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (option) => {
    onChange(
      selected.includes(option)
        ? selected.filter((s) => s !== option)
        : [...selected, option]
    );
  };

  const removeTag = (option, e) => {
    e.stopPropagation();
    onChange(selected.filter((s) => s !== option));
  };

  return (
    <div ref={ref} style={{ marginBottom: 4 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          minHeight: 42, border: `1.5px solid ${open ? "#4EBBC2" : "#d1d5db"}`,
          borderRadius: open ? "8px 8px 0 0" : 8,
          borderBottom: open ? "1.5px solid transparent" : undefined,
          padding: "8px 12px", cursor: "pointer", background: "#fff",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
          {selected.length === 0 ? (
            <span style={{ fontSize: 13, color: "#9CA3AF", fontFamily: "Poppins", lineHeight: "26px" }}>
              Select {label}...
            </span>
          ) : (
            selected.map((s) => (
              <span key={s} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                backgroundColor: "#e0f5f5", color: "#2a9d9d",
                border: "1px solid #4EBBC2", borderRadius: 14,
                padding: "3px 10px 3px 12px", fontSize: 12,
                fontWeight: 500, fontFamily: "Poppins", whiteSpace: "nowrap",
              }}>
                {s}
                <button
                  type="button"
                  onClick={(e) => removeTag(s, e)}
                  style={{
                    background: "none", border: "none", color: "#2a9d9d",
                    cursor: "pointer", fontSize: 15, lineHeight: 1,
                    padding: 0, margin: 0, width: "auto", height: "auto",
                  }}
                >×</button>
              </span>
            ))
          )}
        </div>
        <span style={{
          fontSize: 13, color: "#6B7280", marginTop: 5, marginLeft: 6, flexShrink: 0,
          transition: "transform 0.2s", display: "inline-block",
          transform: open ? "rotate(180deg)" : "none",
        }}>▾</span>
      </div>

      {open && (
        <div style={{
          background: "#fff", border: "1.5px solid #4EBBC2", borderTop: "none",
          borderRadius: "0 0 8px 8px", maxHeight: 180, overflowY: "auto",
          boxSizing: "border-box",
        }}>
          {options.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <div
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", fontSize: 13,
                  fontFamily: "Poppins", color: isSel ? "#2a9d9d" : "#374151",
                  backgroundColor: isSel ? "#e0f5f5" : "#fff",
                  cursor: "pointer", fontWeight: isSel ? 500 : 400,
                }}
              >
                <span style={{ width: 16, fontSize: 13, color: "#4EBBC2", fontWeight: 700, flexShrink: 0 }}>
                  {isSel ? "✓" : ""}
                </span>
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main modal ────────────────────────────────────────────────────────────────
const EditTemplateModal = ({ template, onClose, onSaved }) => {
  const [templateName,   setTemplateName]   = useState(template.template_name   || "");
  const [jobTitle,       setJobTitle]       = useState(template.job_title        || "");
  const [jobType,        setJobType]        = useState(template.job_type         || "");
  const [jobDescription, setJobDescription] = useState(template.job_description  || "");
  const [hourlyRate,     setHourlyRate]     = useState(template.hourly_rate != null ? template.hourly_rate.toString() : "");
  const [streetAddress,  setStreetAddress]  = useState(template.street_address   || "");
  const [city,           setCity]           = useState(template.city             || "");
  const [province,       setProvince]       = useState(template.province         || "");
  const [postalCode,     setPostalCode]     = useState(template.postal_code      || "");
  const [requiredSkills, setRequiredSkills] = useState(Array.isArray(template.required_skills)     ? template.required_skills     : []);
  const [requiredExp,    setRequiredExp]    = useState(Array.isArray(template.required_experience) ? template.required_experience : []);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  // Block e, +, - from hourly rate field
  const blockInvalidRateKeys = (e) => {
    if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
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

  const inputStyle = {
    width: "100%", height: 38, padding: "0 12px", fontSize: 14,
    fontFamily: "Nunito", border: "1px solid #D0D5DD", borderRadius: 8,
    boxSizing: "border-box", outline: "none",
  };

  return (
    <div className="template-modal-overlay" onClick={onClose}>
      <div
        className="template-modal"
        style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Edit Template</h3>
        <p>Update the fields and save to overwrite this template.</p>

        <label>Template Name</label>
        <input type="text" style={inputStyle} value={templateName} onChange={e => setTemplateName(e.target.value)} maxLength={100} autoFocus />

        <label>Job Title</label>
        <input type="text" style={inputStyle} value={jobTitle} onChange={e => setJobTitle(e.target.value)} />

        <label>Job Type</label>
        <input type="text" style={inputStyle} value={jobType} onChange={e => setJobType(e.target.value)} />

        <label>Hourly Rate ($)</label>
        <input
          type="number" min="0" style={inputStyle}
          value={hourlyRate}
          onChange={e => setHourlyRate(e.target.value)}
          onKeyDown={blockInvalidRateKeys}
        />

        <label>Street Address</label>
        <input type="text" style={inputStyle} value={streetAddress} onChange={e => setStreetAddress(e.target.value)} />

        <label>City</label>
        <input type="text" style={inputStyle} value={city} onChange={e => setCity(e.target.value)} />

        <label>Province</label>
        <select
          value={province}
          onChange={e => setProvince(e.target.value)}
          style={{ ...inputStyle, height: 38, padding: "0 12px" }}
        >
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
        <input type="text" style={inputStyle} value={postalCode} onChange={e => setPostalCode(e.target.value)} />

        <label>Job Description</label>
        <textarea
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
          style={{
            width: "100%", height: 200, resize: "vertical", padding: 10,
            fontSize: 14, fontFamily: "Nunito", border: "1px solid #D0D5DD",
            borderRadius: 8, boxSizing: "border-box", outline: "none",
          }}
        />

        <label>Required Skills</label>
        <MultiSelectDropdown
          label="Required Skills"
          options={SKILL_OPTIONS}
          selected={requiredSkills}
          onChange={setRequiredSkills}
        />

        <label style={{ marginTop: 8 }}>Required Experience</label>
        <MultiSelectDropdown
          label="Required Experience"
          options={EXPERIENCE_OPTIONS}
          selected={requiredExp}
          onChange={setRequiredExp}
        />

        {error && <p className="template-modal-error">{error}</p>}

        <div className="template-modal-buttons" style={{ flexWrap: "nowrap", marginTop: 12 }}>
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