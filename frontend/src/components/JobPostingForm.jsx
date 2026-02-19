import "../styles/JobPostingForm.css";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { useUser } from "./UserContext";
import { JOB_STATUS } from "./JobPosting";

// Fields required to publish a job
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
    REQUIRED_FIELDS.filter(f => !jobPost[f.key]?.toString().trim()).map(f => f.label);

const JobPostingForm = ({ job, setDone, onBackClick }) => {
    const { user } = useUser();
    const [editing, setEditing]           = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [submitting, setSubmitting]     = useState(null);
    const [isDirty, setIsDirty]           = useState(false);

    // prompt state: null | "nav-with-title" | "nav-no-title"
    const [promptType, setPromptType]         = useState(null);
    const [pendingNavigation, setPendingNavigation] = useState(null);

    const [jobPost, setJobPost] = useState({
        jobTitle: "", jobType: "", jobDescription: "",
        hourlyRate: "", jobStart: "", jobEnd: "",
        jobStreetAddress: "", jobCity: "", jobProvince: "", jobPostalCode: "",
        user_id: user ? user.id : null,
    });

    const formatDateTimeForInput = (dateTime) => {
        if (!dateTime) return "";
        const date  = new Date(dateTime);
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
                hourlyRate:      job.hourlyrate.toString(),
                jobStreetAddress:job.streetaddress,
                jobCity:         job.city,
                jobProvince:     job.province,
                jobPostalCode:   job.postalcode,
                jobStart:        formatDateTimeForInput(job.jobstart),
                jobEnd:          formatDateTimeForInput(job.jobend),
                job_id:          job.job_id,
                location_id:     job.location_id,
            });
        }
    }, [job]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setIsDirty(true);
        setJobPost(prev => ({ ...prev, [name]: value }));
    };

    // ── Browser tab / refresh guard ───────────────────────────────────────────
    useEffect(() => {
        if (!isDirty || submitting !== null) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty, submitting]);

    // ── Sidebar / toolbar link guard ─────────────────────────────────────────
    useEffect(() => {
        if (!isDirty) return;
        const handleClick = (e) => {
            const anchor = e.target.closest("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("http")) return;

            e.preventDefault();
            e.stopPropagation();

            const nav = () => { window.location.href = href; };
            if (jobPost.jobTitle.trim()) {
                setPromptType("nav-with-title");
            } else {
                setPromptType("nav-no-title");
            }
            setPendingNavigation(() => nav);
        };
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [isDirty, jobPost.jobTitle]);

    // ── Back arrow — registered via ref from JobPosting.jsx ──────────────────
    const triggerBackPrompt = () => {
        if (!isDirty) { setDone(); return; }
        if (jobPost.jobTitle.trim()) {
            setPromptType("nav-with-title");
            setPendingNavigation(null); // null = back arrow, discard calls setDone
        } else {
            setPromptType("nav-no-title");
            setPendingNavigation(null);
        }
    };

    useEffect(() => {
        if (onBackClick) onBackClick.current = triggerBackPrompt;
    }, [isDirty, jobPost.jobTitle]);

    // ── Core submit ───────────────────────────────────────────────────────────
    const handleSubmit = async (status) => {
        setSubmitting(status);
        setErrorMessage("");
        const isDraft = status === JOB_STATUS.DRAFT;

        const locationData = {
            streetAddress: jobPost.jobStreetAddress || "",
            city:          jobPost.jobCity          || (isDraft ? "N/A" : ""),
            province:      jobPost.jobProvince       || (isDraft ? "N/A" : ""),
            postalCode:    jobPost.jobPostalCode     || (isDraft ? "N/A" : ""),
        };

        const updatedJobData = { ...jobPost, locationData, status };
        const apiUrl = editing ? `/api/edit-job/${jobPost.job_id}` : `/api/post-job`;

        try {
            await axios[editing ? "patch" : "post"](
                apiUrl, updatedJobData,
                { headers: { "Content-Type": "application/json" }, withCredentials: true }
            );
            setIsDirty(false);
            setDone();
        } catch (error) {
            console.error("Failed to process job:", error.message);
            setErrorMessage("Failed to process job. Please try again.");
        } finally {
            setSubmitting(null);
        }
    };

    // ── Save as Draft button ──────────────────────────────────────────────────
    const handleSaveAsDraft = () => {
        if (!jobPost.jobTitle.trim()) {
            setErrorMessage("Please enter a Job Title to save as a draft.");
            return;
        }
        setErrorMessage("");
        handleSubmit(JOB_STATUS.DRAFT);
    };

    // ── Post Job button ───────────────────────────────────────────────────────
    const handlePost = () => {
        const missing = getMissingFields(jobPost);
        if (missing.length > 0) {
            setErrorMessage(`Please fill in the following fields before posting: ${missing.join(", ")}.`);
            return;
        }
        setErrorMessage("");
        const targetStatus = editing && job?.status !== JOB_STATUS.DRAFT
            ? job.status : JOB_STATUS.OPEN;
        handleSubmit(targetStatus);
    };

    // ── Prompt actions ────────────────────────────────────────────────────────
    const handlePromptSaveDraft = async () => {
        setPromptType(null);
        await handleSubmit(JOB_STATUS.DRAFT);
        if (pendingNavigation) { pendingNavigation(); setPendingNavigation(null); }
    };

    const handlePromptDiscard = () => {
        setPromptType(null);
        setIsDirty(false);
        if (pendingNavigation) { pendingNavigation(); setPendingNavigation(null); }
        else setDone();
    };

    const handlePromptStay = () => {
        setPromptType(null);
        setPendingNavigation(null);
    };

    const isDraftMode = !editing || job?.status === JOB_STATUS.DRAFT;

    return (
        <>
        <div className="job-posting-form-container">
            <div className="form-inner">
                <div className="top">
                    <div className="top-left">
                        <label htmlFor="jobTitle">Job Title</label>
                        <input type="text" id="jobTitle" name="jobTitle"
                            value={jobPost.jobTitle} onChange={handleChange} />
                        <label htmlFor="jobType">Job Type</label>
                        <input type="text" id="jobType" name="jobType"
                            value={jobPost.jobType} onChange={handleChange} />
                    </div>
                    <div className="top-right">
                        {isDraftMode && (
                            <button type="button" className="draft-btn"
                                onClick={handleSaveAsDraft} disabled={submitting !== null}>
                                {submitting === JOB_STATUS.DRAFT ? "Saving..." : "Save as Draft"}
                            </button>
                        )}
                        <button type="button" className="post-btn"
                            onClick={handlePost} disabled={submitting !== null}>
                            {submitting && submitting !== JOB_STATUS.DRAFT
                                ? "Posting..."
                                : editing
                                    ? job?.status === JOB_STATUS.DRAFT ? "Post Job" : "Update Job"
                                    : "Post Job"}
                        </button>
                    </div>
                </div>

                <div className="bottom">
                    <div className="bottom-left">
                        <h1>Job Details</h1>
                        <div className="details">
                            <label htmlFor="hourlyRate">Hourly Rate ($)</label>
                            <input type="number" min="0" id="hourlyRate" name="hourlyRate"
                                value={jobPost.hourlyRate} onChange={handleChange} />
                            <label htmlFor="jobStart">Job Start Date, Time</label>
                            <input type="datetime-local" id="jobStart" name="jobStart"
                                value={jobPost.jobStart} onChange={handleChange} />
                            <label htmlFor="jobEnd">Job End Date, Time</label>
                            <input type="datetime-local" id="jobEnd" name="jobEnd"
                                value={jobPost.jobEnd} onChange={handleChange} />
                        </div>
                        <h1>Location</h1>
                        <div className="location">
                            <label htmlFor="jobStreetAddress">Street Address</label>
                            <input type="text" id="jobStreetAddress" name="jobStreetAddress"
                                value={jobPost.jobStreetAddress} onChange={handleChange} />
                            <label htmlFor="jobCity">City</label>
                            <input type="text" id="jobCity" name="jobCity"
                                value={jobPost.jobCity} onChange={handleChange} />
                            <div className="province">
                                <label htmlFor="jobProvince">Province</label>
                                <select id="jobProvince" name="jobProvince"
                                    value={jobPost.jobProvince} onChange={handleChange}>
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
                                <input type="text" id="jobPostalCode" name="jobPostalCode"
                                    value={jobPost.jobPostalCode} onChange={handleChange} />
                            </div>
                        </div>
                    </div>
                    <div className="bottom-right">
                        <label htmlFor="jobDescription">Job Description</label>
                        <textarea id="jobDescription" name="jobDescription"
                            value={jobPost.jobDescription} onChange={handleChange} />
                    </div>
                </div>
            </div>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>

        {/* ── Prompt: has title — Stay / Discard / Save as Draft ── */}
        {promptType === "nav-with-title" && (
            <div className="draft-prompt-overlay">
                <div className="draft-prompt">
                    <h3>Save as Draft?</h3>
                    <p>
                        You have unsaved changes to <strong>"{jobPost.jobTitle}"</strong>.
                        Would you like to save it as a draft before leaving?
                    </p>
                    <div className="draft-prompt-buttons">
                        <button className="draft-prompt-cancel" onClick={handlePromptStay}>Stay</button>
                        <button className="draft-prompt-discard" onClick={handlePromptDiscard}>Discard</button>
                        <button className="draft-prompt-save" onClick={handlePromptSaveDraft}
                            disabled={submitting !== null}>
                            {submitting === JOB_STATUS.DRAFT ? "Saving..." : "Save as Draft"}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ── Prompt: no title — Stay / Discard only ── */}
        {promptType === "nav-no-title" && (
            <div className="draft-prompt-overlay">
                <div className="draft-prompt">
                    <h3>Leave without saving?</h3>
                    <p>
                        You need to enter a <strong>Job Title</strong> to save as a draft.
                        Would you like to stay and add a title, or discard your changes?
                    </p>
                    <div className="draft-prompt-buttons">
                        <button className="draft-prompt-cancel" onClick={handlePromptStay}>
                            Stay &amp; Add Title
                        </button>
                        <button className="draft-prompt-discard" onClick={handlePromptDiscard}>
                            Discard
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default JobPostingForm;