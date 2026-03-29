import "../styles/JobPostingForm.css";
import axios from "axios";
import React, { useEffect, useState, useRef } from "react";
import { useUser } from "./UserContext";
import { JOB_STATUS } from "./JobPosting";
import SaveTemplateModal from "./SaveTemplateModal";
import TemplateLoader from "./TemplateLoader";

// ── Options ───────────────────────────────────────────────────────────────────
const SKILL_OPTIONS = [
  "French", "Communication", "Mandarin", "Cantonese",
  "Public Security", "Customer Service", "Food Safety Knowledge",
  "First Aid", "Business Management", "Inventory Management",
  "Delivery Driving", "Basic Carpentry",
];

const EXPERIENCE_OPTIONS = ["0-2 years", "3-5 years", "5+ years"];

// ── Multi-select dropdown ─────────────────────────────────────────────────────
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
    <div className="msd-wrapper" ref={ref}>
      <label className="msd-label">{label}</label>

      {/* Trigger bar */}
      <div
        className={`msd-trigger ${open ? "msd-trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="msd-tags-row">
          {selected.length === 0 ? (
            <span className="msd-placeholder">Select {label}...</span>
          ) : (
            selected.map((s) => (
              <span key={s} className="msd-tag">
                {s}
                <button type="button" className="msd-tag-remove" onClick={(e) => removeTag(s, e)}>×</button>
              </span>
            ))
          )}
        </div>
        <span className={`msd-chevron ${open ? "msd-chevron--up" : ""}`}>▾</span>
      </div>

      {/* Dropdown list */}
      {open && (
        <div className="msd-dropdown">
          {options.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <div
                key={opt}
                className={`msd-option ${isSel ? "msd-option--selected" : ""}`}
                onClick={() => toggle(opt)}
              >
                <span className="msd-check">{isSel ? "✓" : ""}</span>
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Required fields ───────────────────────────────────────────────────────────
const REQUIRED_FIELDS = [
  { key: "jobTitle",      label: "Job Title" },
  { key: "jobType",       label: "Job Type" },
  { key: "hourlyRate",    label: "Hourly Rate" },
  { key: "jobStart",      label: "Job Start Date & Time" },
  { key: "jobEnd",        label: "Job End Date & Time" },
  { key: "jobCity",       label: "City" },
  { key: "jobProvince",   label: "Province" },
  { key: "jobPostalCode", label: "Postal Code" },
];

const getMissingFields = (jobPost) =>
  REQUIRED_FIELDS.filter((f) => !jobPost[f.key]?.toString().trim()).map((f) => f.label);

// ── Component ─────────────────────────────────────────────────────────────────
const JobPostingForm = ({ job, setDone, onBackClick }) => {
  const { user } = useUser();
  const [editing, setEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [promptType, setPromptType] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const [jobPost, setJobPost] = useState({
    jobTitle: "", jobType: "", jobDescription: "",
    hourlyRate: "", jobStart: "", jobEnd: "",
    jobStreetAddress: "", jobCity: "", jobProvince: "", jobPostalCode: "",
    user_id: user ? user.id : null,
    requiredSkills: [],
    requiredExperience: [],
  });

  useEffect(() => {
    if (user && user.id && !jobPost.user_id)
      setJobPost((prev) => ({ ...prev, user_id: user.id }));
  }, [user, jobPost.user_id]);

  // ── Templates ──────────────────────────────────────────────────────────────
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await axios.get("/api/templates", { withCredentials: true });
      setTemplates(res.data.templates);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleApplyTemplate = (template) => {
    setJobPost((prev) => ({
      ...prev,
      jobTitle:           template.job_title        || "",
      jobType:            template.job_type         || "",
      jobDescription:     template.job_description  || "",
      hourlyRate:         template.hourly_rate != null ? template.hourly_rate.toString() : "",
      jobStreetAddress:   template.street_address   || "",
      jobCity:            template.city             || "",
      jobProvince:        template.province         || "",
      jobPostalCode:      template.postal_code      || "",
      requiredSkills:     Array.isArray(template.required_skills)     ? template.required_skills     : [],
      requiredExperience: Array.isArray(template.required_experience) ? template.required_experience : [],
    }));
    setIsDirty(true);
  };


  const formatDateTimeForInput = (dateTime) => {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day   = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}T${date.toTimeString().slice(0, 5)}`;
  };

  useEffect(() => {
    if (job) {
      setEditing(true);
      setJobPost({
        ...job,
        jobTitle:        job.jobtitle,
        jobType:         job.jobtype,
        jobDescription:  job.jobdescription,
        hourlyRate:      job.hourlyrate != null ? job.hourlyrate.toString() : "",
        jobStreetAddress: job.streetaddress,
        jobCity:         job.city,
        jobProvince:     job.province,
        jobPostalCode:   job.postalcode,
        jobStart:        formatDateTimeForInput(job.jobstart),
        jobEnd:          formatDateTimeForInput(job.jobend),
        job_id:          job.job_id,
        location_id:     job.location_id,
        requiredSkills:     Array.isArray(job.required_skills)     ? job.required_skills     : [],
        requiredExperience: Array.isArray(job.required_experience) ? job.required_experience : [],
      });
    }
  }, [job]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setIsDirty(true);
    setJobPost((prev) => ({ ...prev, [name]: value }));
    if (["jobStreetAddress", "jobCity", "jobProvince", "jobPostalCode"].includes(name) && errorMessage === "The address is invalid. Please enter a valid address.") {
      setErrorMessage("");
    }
  };

  const handleSkillsChange     = (v) => { setIsDirty(true); setJobPost((p) => ({ ...p, requiredSkills: v })); };
  const handleExperienceChange = (v) => { setIsDirty(true); setJobPost((p) => ({ ...p, requiredExperience: v })); };

  useEffect(() => {
    if (!isDirty || submitting !== null) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty, submitting]);

  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (e) => {
      const anchor = e.target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) return;
      e.preventDefault(); e.stopPropagation();
      setPromptType(jobPost.jobTitle.trim() ? "nav-with-title" : "nav-no-title");
      setPendingNavigation(() => () => { window.location.href = href; });
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty, jobPost.jobTitle]);

  const triggerBackPrompt = () => {
    if (!isDirty) { setDone(); return; }
    setPromptType(jobPost.jobTitle.trim() ? "nav-with-title" : "nav-no-title");
    setPendingNavigation(null);
  };

  useEffect(() => {
    if (onBackClick) onBackClick.current = triggerBackPrompt;
  }, [isDirty, jobPost.jobTitle]);

  const getDateError = () => {
    if (jobPost.jobStart && jobPost.jobEnd &&
        new Date(jobPost.jobEnd) <= new Date(jobPost.jobStart))
      return "Job End Date & Time must be after Job Start Date & Time.";
    return null;
  };

  const handleSubmit = async (status) => {
    setSubmitting(status); setErrorMessage("");
    const locationData = {
      streetAddress: jobPost.jobStreetAddress || "",
      city:          jobPost.jobCity          || "",
      province:      jobPost.jobProvince      || "",
      postalCode:    jobPost.jobPostalCode    || "",
    };
    const updatedJobData = {
      ...jobPost,
      hourlyRate:         jobPost.hourlyRate === "" ? null : jobPost.hourlyRate,
      jobStart:           jobPost.jobStart   === "" ? null : jobPost.jobStart,
      jobEnd:             jobPost.jobEnd     === "" ? null : jobPost.jobEnd,
      locationData, status,
      requiredSkills:     jobPost.requiredSkills     || [],
      requiredExperience: jobPost.requiredExperience || [],
    };
    const apiUrl = editing ? `/api/edit-job/${jobPost.job_id}` : `/api/post-job`;
    try {
      await axios[editing ? "patch" : "post"](apiUrl, updatedJobData,
        { headers: { "Content-Type": "application/json" }, withCredentials: true });
      setIsDirty(false); setDone();
    } catch (error) {
      console.error("Failed to process job:", error.message);
      const backendMessage = error.response?.data?.message;
      if (
        backendMessage === "Street address, city, province, and postal code are required." ||
        backendMessage === "Address could not be validated. Please enter a complete, real address."
      ) {
        setErrorMessage("The address is invalid. Please enter a valid address.");
      } else {
        setErrorMessage("Something went wrong. Please check your inputs and try again.");
      }
    } finally { setSubmitting(null); }
  };

  const handleSaveAsDraft = () => {
    const dateError = getDateError();
    if (dateError) { setErrorMessage(dateError); return; }
    if (!jobPost.jobTitle.trim()) { setErrorMessage("Please enter a Job Title to save as a draft."); return; }
    if (!jobPost.jobType.trim())  { setErrorMessage("Please enter a Job Type to save as a draft.");  return; }
    setErrorMessage(""); handleSubmit(JOB_STATUS.DRAFT);
  };

  const handlePost = () => {
    const dateError = getDateError();
    if (dateError) { setErrorMessage(dateError); return; }
    const missing = getMissingFields(jobPost);
    if (missing.length > 0) { setErrorMessage(`Please fill in: ${missing.join(", ")}.`); return; }
    setErrorMessage("");
    handleSubmit(editing && job?.status !== JOB_STATUS.DRAFT ? job.status : JOB_STATUS.OPEN);
  };

  const handlePromptSaveDraft = async () => {
    if (!jobPost.jobTitle.trim() || !jobPost.jobType.trim()) {
      setPromptType(null);
      setErrorMessage(!jobPost.jobTitle.trim()
        ? "Please enter a Job Title to save as a draft."
        : "Please enter a Job Type to save as a draft.");
      return;
    }
    setPromptType(null);
    await handleSubmit(JOB_STATUS.DRAFT);
    if (pendingNavigation) { pendingNavigation(); setPendingNavigation(null); }
  };

  const handlePromptDiscard = () => {
    setPromptType(null); setIsDirty(false);
    if (pendingNavigation) { pendingNavigation(); setPendingNavigation(null); }
    else setDone();
  };

  const handlePromptStay = () => { setPromptType(null); setPendingNavigation(null); };

  const isDraftMode = !editing || job?.status === JOB_STATUS.DRAFT;

  return (
    <>
      <div className="job-posting-form-container">
        <div className="form-inner">
          <div className="top">
            <div className="top-left">
              <label htmlFor="jobTitle">Job Title</label>
              <input type="text" id="jobTitle" name="jobTitle" value={jobPost.jobTitle} onChange={handleChange} />
              <label htmlFor="jobType">Job Type</label>
              <input type="text" id="jobType" name="jobType" value={jobPost.jobType} onChange={handleChange} />
            </div>
            <div className="top-right">
              <TemplateLoader
                templates={templates}
                loading={loadingTemplates}
                onSelect={handleApplyTemplate}
                onTemplatesChanged={fetchTemplates}
              />
              <button type="button" className="template-btn" onClick={() => setShowTemplateModal(true)} disabled={submitting !== null}>Save as Template</button>
              {isDraftMode && (
                <button type="button" className="draft-btn" onClick={handleSaveAsDraft} disabled={submitting !== null}>
                  {submitting === JOB_STATUS.DRAFT ? "Saving..." : "Save as Draft"}
                </button>
              )}
              <button type="button" className="post-btn" onClick={handlePost} disabled={submitting !== null}>
                {submitting && submitting !== JOB_STATUS.DRAFT ? "Posting..."
                  : editing ? (job?.status === JOB_STATUS.DRAFT ? "Post Job" : "Update Job") : "Post Job"}
              </button>
            </div>
          </div>

          <div className="bottom">
            <div className="bottom-left">
              <h1>Job Details</h1>
              <div className="details">
                <label htmlFor="hourlyRate">Hourly Rate ($)</label>
                <input type="number" min="0" id="hourlyRate" name="hourlyRate" value={jobPost.hourlyRate} onChange={handleChange} onKeyDown={(e) => ["e","E","+","-"].includes(e.key) && e.preventDefault()} />
                <label htmlFor="jobStart">Job Start Date, Time</label>
                <input type="datetime-local" id="jobStart" name="jobStart" value={jobPost.jobStart} onChange={handleChange} />
                <label htmlFor="jobEnd">Job End Date, Time</label>
                <input type="datetime-local" id="jobEnd" name="jobEnd" value={jobPost.jobEnd} onChange={handleChange} />
              </div>
              <h1>Location</h1>
              <div className="location">
                <label htmlFor="jobStreetAddress">Street Address</label>
                <input type="text" id="jobStreetAddress" name="jobStreetAddress" value={jobPost.jobStreetAddress} onChange={handleChange} />
                <label htmlFor="jobCity">City</label>
                <input type="text" id="jobCity" name="jobCity" value={jobPost.jobCity} onChange={handleChange} />
                <div className="province">
                  <label htmlFor="jobProvince">Province</label>
                  <select id="jobProvince" name="jobProvince" value={jobPost.jobProvince} onChange={handleChange}>
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
                </div>
                <div className="postal">
                  <label htmlFor="jobPostalCode">Postal Code</label>
                  <input type="text" id="jobPostalCode" name="jobPostalCode" value={jobPost.jobPostalCode} onChange={handleChange} />
                </div>
              </div>

              {/* ── Required Skills & Experience ── */}
              <div className="requirements-section">
                <MultiSelectDropdown
                  label="Required Skills"
                  options={SKILL_OPTIONS}
                  selected={jobPost.requiredSkills}
                  onChange={handleSkillsChange}
                />
                <MultiSelectDropdown
                  label="Required Experience"
                  options={EXPERIENCE_OPTIONS}
                  selected={jobPost.requiredExperience}
                  onChange={handleExperienceChange}
                />
              </div>
            </div>

            <div className="bottom-right">
              <label htmlFor="jobDescription">Job Description</label>
              <textarea id="jobDescription" name="jobDescription" value={jobPost.jobDescription} onChange={handleChange} />
            </div>
          </div>
        </div>
        {errorMessage     && <p className="error-message">{errorMessage}</p>}
        {templateSavedMsg && <p className="template-saved-msg">{templateSavedMsg}</p>}
      </div>

      {promptType === "nav-with-title" && (
        <div className="draft-prompt-overlay">
          <div className="draft-prompt">
            <h3>Save as Draft?</h3>
            <p>You have unsaved changes to <strong>"{jobPost.jobTitle}"</strong>. Save as draft before leaving?</p>
            <div className="draft-prompt-buttons">
              <button className="draft-prompt-cancel"  onClick={handlePromptStay}>Stay</button>
              <button className="draft-prompt-discard" onClick={handlePromptDiscard}>Discard</button>
              <button className="draft-prompt-save"    onClick={handlePromptSaveDraft} disabled={submitting !== null}>
                {submitting === JOB_STATUS.DRAFT ? "Saving..." : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <SaveTemplateModal jobPost={jobPost}
          onClose={() => setShowTemplateModal(false)}
          onSaved={() => { setTemplateSavedMsg("Template saved successfully!"); setTimeout(() => setTemplateSavedMsg(""), 3000); fetchTemplates(); }}
        />
      )}

      {promptType === "nav-no-title" && (
        <div className="draft-prompt-overlay">
          <div className="draft-prompt">
            <h3>Leave without saving?</h3>
            <p>You need a <strong>Job Title</strong> to save as a draft.</p>
            <div className="draft-prompt-buttons">
              <button className="draft-prompt-cancel"  onClick={handlePromptStay}>Stay &amp; Add Title</button>
              <button className="draft-prompt-discard" onClick={handlePromptDiscard}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default JobPostingForm;