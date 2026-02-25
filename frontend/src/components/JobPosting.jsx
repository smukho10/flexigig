import "../styles/JobPosting.css";
import axios from "axios";
import CalendarIcon from "../assets/images/CalendarIcon.png";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import DollarSign from "../assets/images/DollarSign.png";
import PlusSign from "../assets/images/PlusSign.png";
import { useEffect, useState, useRef } from "react";
import { useUser } from "./UserContext";
import JobPostingForm from "./JobPostingForm";

// Status constants — sync these with your backend enum/values
export const JOB_STATUS = {
    DRAFT: "draft",
    OPEN: "open",
    IN_REVIEW: "in-review",
    FILLED: "filled",
    COMPLETED: "completed",
};

const TAB_CONFIG = [
    { key: JOB_STATUS.DRAFT,     label: "Drafts",    color: "#6B7280" },
    { key: JOB_STATUS.OPEN,      label: "Open",      color: "#4EBBC2" },
    { key: JOB_STATUS.IN_REVIEW, label: "In Review", color: "#F59E0B" },
    { key: JOB_STATUS.FILLED,    label: "Filled",    color: "#3B82F6" },
    { key: JOB_STATUS.COMPLETED, label: "Completed", color: "#10B981" },
];

// Next status transition for each state
const NEXT_STATUS = {
    [JOB_STATUS.DRAFT]:     JOB_STATUS.OPEN,
    [JOB_STATUS.OPEN]:      JOB_STATUS.IN_REVIEW,
    [JOB_STATUS.IN_REVIEW]: JOB_STATUS.FILLED,
    [JOB_STATUS.FILLED]:    JOB_STATUS.COMPLETED,
};

const NEXT_STATUS_LABEL = {
    [JOB_STATUS.DRAFT]:     "Publish",
    [JOB_STATUS.OPEN]:      "Mark In Review",
    [JOB_STATUS.IN_REVIEW]: "Mark Filled",
    [JOB_STATUS.FILLED]:    "Mark Completed",
};

const JobPosting = () => {
    const { user } = useUser();
    const [jobs, setJobs] = useState([]);
    const [activeTab, setActiveTab] = useState(JOB_STATUS.OPEN);
    const [createJob, setCreateJob] = useState(false);
    const [editJob, setEditJob] = useState(false);
    const [removeJob, setRemoveJob] = useState(false);
    const [statusLoading, setStatusLoading] = useState(null);
    const backClickRef = useRef(null); // ref to form's back-intercept function
    const [publishMissingPrompt, setPublishMissingPrompt] = useState(null); // { job, missingFields }

    // Local overrides for status — keyed by job_id.
    // This lets status changes feel instant even before the backend endpoint exists.
    // TODO (backend): once PATCH /api/job-status/:id is live, you can remove this
    // and just rely on re-fetching from the DB after each status change.
    const [localStatusOverrides, setLocalStatusOverrides] = useState({});

    const fetchJobs = async () => {
        if (user && user.id) {
            try {
                const response = await axios.get(`/api/posted-jobs/${user.id}`, { withCredentials: true });
                setJobs(
                    response.data.jobs.sort((a, b) => a.jobtitle.localeCompare(b.jobtitle))
                );
            } catch (error) {
                console.error("Error fetching posted jobs:", error);
            }
        }
    };

    useEffect(() => {
        fetchJobs();
    }, [user, createJob, editJob]);

    const handleCreateNew = () => setCreateJob(true);

    // ── Remove ────────────────────────────────────────────────────────────────
    const handleRemove = async (e) => {
        if (!removeJob) {
            setRemoveJob(jobs.find(j => j.job_id.toString() === e.target.value));
        } else {
            try {
                await axios.delete(`/api/delete-job/${removeJob.job_id}`, { withCredentials: true });
                setRemoveJob(false);
                fetchJobs();
            } catch (error) {
                console.error("Failed to delete job:", error);
            }
        }
    };

    const handleCancelRemove = () => setRemoveJob(false);

    const handleEdit = (e) => {
        setEditJob(jobs.find(job => job.job_id.toString() === e.target.value));
    };

    const handleBack = () => {
        if (createJob) setCreateJob(false);
        else setEditJob(false);
    };

    // ── Status advancement ────────────────────────────────────────────────────
    const PUBLISH_REQUIRED = [
        { key: "jobtitle",      label: "Job Title" },
        { key: "jobtype",       label: "Job Type" },
        { key: "hourlyrate",    label: "Hourly Rate" },
        { key: "jobstart",      label: "Job Start Date & Time" },
        { key: "jobend",        label: "Job End Date & Time" },
        { key: "city",          label: "City" },
        { key: "province",      label: "Province" },
        { key: "postalcode",    label: "Postal Code" },
    ];

    const handleStatusChange = async (job, newStatus) => {
        // If publishing a draft, check all required fields first
        if (newStatus === JOB_STATUS.OPEN) {
            const missing = PUBLISH_REQUIRED.filter(f =>
                !job[f.key]?.toString().trim() || job[f.key] === "N/A"
            ).map(f => f.label);

            if (missing.length > 0) {
                setPublishMissingPrompt({ job, missingFields: missing });
                return;
            }
        }

        setStatusLoading(job.job_id);
        setLocalStatusOverrides(prev => ({ ...prev, [job.job_id]: newStatus }));
        setActiveTab(newStatus);

        try {
            await axios.patch(
                `/api/job-status/${job.job_id}`,
                { status: newStatus },
                { withCredentials: true }
            );
            setJobs(prev =>
                prev.map(j => j.job_id === job.job_id ? { ...j, status: newStatus } : j)
            );
        } catch (error) {
            console.warn("Status API not ready yet — status tracked locally only:", error.message);
        } finally {
            setStatusLoading(null);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const formatDateForDisplay = (dateTime) => {
        if (!dateTime) return "";
        return new Date(dateTime).toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    // Derive status — priority: localOverride > DB value > fallback "open"
    // TODO (backend): once status is reliably stored in DB, the localStatusOverrides
    // layer can be removed. The fallback "open" handles existing jobs with no status yet.
    const getJobStatus = (job) =>
        localStatusOverrides[job.job_id] ?? job.status ?? JOB_STATUS.OPEN;

    const tabJobs = jobs.filter(j => getJobStatus(j) === activeTab);
    const tabConfig = TAB_CONFIG.find(t => t.key === activeTab);

    // Badge counts per tab
    const countByStatus = (status) => jobs.filter(j => getJobStatus(j) === status).length;

    // ── Render job card ───────────────────────────────────────────────────────
    const renderJobCard = (job) => {
        const status = getJobStatus(job);
        const nextStatus = NEXT_STATUS[status];
        const nextLabel = NEXT_STATUS_LABEL[status];
        const isLoading = statusLoading === job.job_id;
        const statusCfg = TAB_CONFIG.find(t => t.key === status);

        return (
            <li key={job.job_id} className="job-card" style={{ "--status-color": statusCfg?.color }}>
                {/* Left border accent */}
                <span className="job-card-accent" />

                <div className="left">
                    <h2 className="posting-header">
                        {job.jobtitle}
                        {job.jobfilled && (
                            <span style={{ color: "#C2554E", marginLeft: 10 }}>JOB FILLED</span>
                        )}
                    </h2>
                    <div>
                        <img src={DollarSign} alt="dollar-sign" width="22px" height="auto" />
                        {job.hourlyrate}/hr
                    </div>
                    <div>
                        <img id="calendar-icon" src={CalendarIcon} alt="calendar-icon" width="22px" height="auto" />
                        {formatDateForDisplay(job.jobstart)}
                    </div>
                </div>

                <div className="right">
                    {/* Status badge */}
                    <span className="status-badge" style={{ backgroundColor: statusCfg?.color }}>
                        {statusCfg?.label}
                    </span>

                    <div className="card-actions">
                        {/* Advance status button (not shown for completed) */}
                        {nextStatus && (
                            <button
                                className="advance-btn"
                                style={{ backgroundColor: TAB_CONFIG.find(t => t.key === nextStatus)?.color }}
                                disabled={isLoading}
                                onClick={() => handleStatusChange(job, nextStatus)}
                            >
                                {isLoading ? "..." : nextLabel}
                            </button>
                        )}

                        {/* Edit — shown for draft and open jobs */}
                        {(status === JOB_STATUS.DRAFT || status === JOB_STATUS.OPEN) && (
                            <button id="edit-btn" value={job.job_id} onClick={handleEdit}>
                                Edit
                            </button>
                        )}

                        {/* Remove — always available */}
                        <button id="remove-btn" value={job.job_id} onClick={handleRemove}>
                            Remove
                        </button>
                    </div>
                </div>
            </li>
        );
    };

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <div className="job-posting-container">
            {!createJob && !editJob ? (

                <div>
                    <h1 className="page-header">Job Posting</h1>

                    <button className="create-new-btn" onClick={handleCreateNew}>
                        <span>Create New</span>
                        <img src={PlusSign} alt="create-new" width="13px" height="auto" />
                    </button>

                    {/* ── Status Tabs ── */}
                    <div className="status-tabs">
                        {TAB_CONFIG.map(tab => {
                            const count = countByStatus(tab.key);
                            return (
                                <button
                                    key={tab.key}
                                    className={`status-tab ${activeTab === tab.key ? "active" : ""}`}
                                    style={{ "--tab-color": tab.color }}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    {tab.label}
                                    {count > 0 && (
                                        <span className="tab-badge">{count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Job list for active tab ── */}
                    {tabJobs.length === 0 ? (
                        <div className="empty-tab">
                            <p>No jobs in <strong>{tabConfig?.label}</strong></p>
                        </div>
                    ) : (
                        <ul style={{ listStyleType: "none" }}>
                            {tabJobs.map(renderJobCard)}
                        </ul>
                    )}
                </div>
            ) : (
                <>
                    <img
                        id="back-btn"
                        src={ChevronLeft}
                        alt="back"
                        width="45px"
                        height="auto"
                        onClick={() => {
                            // If form has registered a back handler, use it (triggers draft prompt)
                            if (backClickRef.current) backClickRef.current();
                            else handleBack();
                        }}
                    />
                    <JobPostingForm
                        job={editJob || undefined}
                        setDone={handleBack}
                        onBackClick={backClickRef}
                    />
                </>
            )}

            {/* ── Remove confirmation modal ── */}
            {removeJob && (
                <div className="remove-job-container">
                    <div className="prompt">
                        <div className="prompt-text">
                            <p>Are you sure you want to remove</p>
                            <p><strong>{removeJob.jobtitle}</strong>?</p>
                        </div>
                        <div className="prompt-buttons">
                            <button onClick={handleCancelRemove}>Cancel</button>
                            <button className="remove-btn" onClick={handleRemove}>Remove</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Publish blocked — missing fields modal ── */}
            {publishMissingPrompt && (
                <div className="draft-prompt-overlay" onClick={() => setPublishMissingPrompt(null)}>
                    <div className="draft-prompt" onClick={e => e.stopPropagation()}>
                        <h3>Can't Publish Yet</h3>
                        <p>
                            <strong>"{publishMissingPrompt.job.jobtitle}"</strong> is missing the
                            following required fields:
                        </p>
                        <div className="missing-fields-chips">
                            {publishMissingPrompt.missingFields.map(f => (
                                <span key={f} className="missing-field-chip">{f}</span>
                            ))}
                        </div>
                        <p style={{ fontSize: "13px", color: "#6B7280", marginBottom: "20px" }}>
                            Click <strong>Fill in Fields</strong> to open the editor and complete them.
                        </p>
                        <div className="draft-prompt-buttons">
                            <button className="draft-prompt-cancel"
                                onClick={() => setPublishMissingPrompt(null)}>
                                Cancel
                            </button>
                            <button className="draft-prompt-save"
                                onClick={() => {
                                    setEditJob(publishMissingPrompt.job);
                                    setPublishMissingPrompt(null);
                                }}>
                                Fill in Fields
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobPosting;