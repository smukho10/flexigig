import React, { useState } from "react";
import axios from "axios";
import "../styles/SaveTemplateModal.css";

const SaveTemplateModal = ({ jobPost, onClose, onSaved }) => {
    const [templateName, setTemplateName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (!templateName.trim()) {
            setError("Please enter a template name.");
            return;
        }
        setSaving(true);
        setError("");
        try {
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

    return (
        <div className="template-modal-overlay" onClick={onClose}>
            <div className="template-modal" onClick={e => e.stopPropagation()}>
                <h3>Save as Template</h3>
                <p>Give this template a name so you can reuse it later.</p>
                <label htmlFor="templateName">Template Name</label>
                <input
                    id="templateName"
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Weekend Bartender Shift"
                    maxLength={100}
                    autoFocus
                />
                {error && <p className="template-modal-error">{error}</p>}
                <div className="template-modal-buttons">
                    <button
                        className="template-modal-cancel"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        className="template-modal-save"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save Template"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaveTemplateModal;
