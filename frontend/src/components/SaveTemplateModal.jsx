import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "../styles/SaveTemplateModal.css";

const SaveTemplateModal = ({ jobPost, templates = [], onClose, onSaved }) => {
  const [templateName, setTemplateName]   = useState("");
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [hasTyped, setHasTyped]           = useState(false);
  const wrapperRef                        = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = templates.filter((t) =>
    t.template_name.toLowerCase().includes(templateName.trim().toLowerCase())
  );

  const matchedTemplate = templates.find(
    (t) => t.template_name.toLowerCase() === templateName.trim().toLowerCase()
  );

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError("Please enter a template name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (matchedTemplate) {
        await axios.put(
          `/api/templates/${matchedTemplate.template_id}`,
          {
            template_name:    templateName.trim(),
            jobTitle:         jobPost.jobTitle,
            jobType:          jobPost.jobType,
            jobDescription:   jobPost.jobDescription,
            hourlyRate:       jobPost.hourlyRate,
            jobStreetAddress: jobPost.jobStreetAddress,
            jobCity:          jobPost.jobCity,
            jobProvince:      jobPost.jobProvince,
            jobPostalCode:    jobPost.jobPostalCode,
            requiredSkills:     jobPost.requiredSkills     || [],
            requiredExperience: jobPost.requiredExperience || [],
          },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          "/api/templates",
          {
            template_name:    templateName.trim(),
            jobTitle:         jobPost.jobTitle,
            jobType:          jobPost.jobType,
            jobDescription:   jobPost.jobDescription,
            hourlyRate:       jobPost.hourlyRate,
            jobStreetAddress: jobPost.jobStreetAddress,
            jobCity:          jobPost.jobCity,
            jobProvince:      jobPost.jobProvince,
            jobPostalCode:    jobPost.jobPostalCode,
            requiredSkills:     jobPost.requiredSkills     || [],
            requiredExperience: jobPost.requiredExperience || [],
          },
          { withCredentials: true }
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save template.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  };

  const handleSelectFromDropdown = (name) => {
    setTemplateName(name);
    setDropdownOpen(false);
    setError("");
  };

  return (
    <div className="template-modal-overlay" onClick={onClose}>
      <div className="template-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Save as Template</h3>
        <p>Give this template a name so you can reuse it later.</p>
        <label htmlFor="templateName">Template Name</label>

        <div ref={wrapperRef} style={{ minHeight: 100 }}>
          <div style={{ position: "relative" }}>
            <input
              id="templateName"
              type="text"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setHasTyped(true);
                setDropdownOpen(e.target.value.trim().length > 0);
                setError("");
              }}
              onFocus={() => {}}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Weekend Bartender Shift"
              maxLength={100}
              autoFocus
              style={{ paddingRight: 32 }}
            />
            <span
              style={{
                position: "absolute", right: 10, top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13, color: "#9CA3AF",
                pointerEvents: "none",
              }}
            >🔍</span>
          </div>

          {dropdownOpen && filtered.length > 0 && (
            <div style={{
              background: "#fff",
              border: "1.5px solid #4EBBC2",
              borderTop: "none",
              borderRadius: "0 0 8px 8px",
              maxHeight: 60,
              overflowY: "auto",
            }}>
              {filtered.map((t) => (
                <div
                  key={t.template_id}
                  onMouseDown={() => handleSelectFromDropdown(t.template_name)}
                  style={{
                    padding: "9px 14px",
                    fontSize: 13,
                    fontFamily: "Poppins",
                    color: "#374151",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f0fbfb"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                >
                  <span>{t.template_name}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>update</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {templateName.trim() && (
          <p style={{ margin: 0, fontSize: 12, color: matchedTemplate ? "#2a9d9d" : "#9CA3AF" }}>
            {matchedTemplate
              ? `"${matchedTemplate.template_name}" will be updated.`
              : "A new template will be created."}
          </p>
        )}

        {error && <p className="template-modal-error">{error}</p>}

        <div className="template-modal-buttons">
          <button className="template-modal-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="template-modal-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveTemplateModal;