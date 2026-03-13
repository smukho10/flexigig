import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import "../styles/ApplicantsPage.css";

const APPLICANTS_PER_PAGE = 20;

const STATUS_COLORS = {
    ACCEPTED:   { bg: "#D1FAE5", color: "#065F46" },
    REJECTED:   { bg: "#FEE2E2", color: "#991B1B" },
    IN_REVIEW:  { bg: "#FEF3C7", color: "#92400E" },
    APPLIED:    { bg: "#E0E7FF", color: "#3730A3" },
    WITHDRAWN:  { bg: "#F3F4F6", color: "#6B7280" },
};

const ApplicantsPage = () => {
    const { jobId } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();

    const [applicants, setApplicants] = useState([]);
    const [jobTitle] = useState(state?.job?.jobtitle || "");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const fetchApplicants = async () => {
        try {
            const res = await axios.get(`/api/job-applicants/${jobId}`, { withCredentials: true });
            setApplicants(res.data.applicants);
        } catch (error) {
            console.error("Error fetching applicants:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplicants();
    }, [jobId]);

    const updateStatus = async (applicationId, status) => {
        try {
            await axios.patch(
                `/api/applications/${applicationId}/status`,
                { status },
                { withCredentials: true }
            );
            fetchApplicants();
        } catch (error) {
            console.error("Error updating application status:", error);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit",
        });
    };

    const totalPages = Math.ceil(applicants.length / APPLICANTS_PER_PAGE);
    const paginated = applicants.slice((page - 1) * APPLICANTS_PER_PAGE, page * APPLICANTS_PER_PAGE);

    return (
        <div className="applicants-page-container">
            {/* Header */}
            <div className="applicants-page-header">
                <img
                    src={ChevronLeft}
                    alt="back"
                    className="applicants-back-btn"
                    onClick={() => navigate("/my-jobs")}
                />
                <div>
                    <h1 className="applicants-page-title">Applicants</h1>
                    {jobTitle && <p className="applicants-job-subtitle">{jobTitle}</p>}
                </div>
            </div>

            {/* Summary bar */}
            {!loading && (
                <div className="applicants-summary-bar">
                    <span className="summary-count">{applicants.length} total applicant{applicants.length !== 1 ? "s" : ""}</span>
                    <span className="summary-note">Sorted by application date — earliest first</span>
                </div>
            )}

            {loading ? (
                <p className="applicants-loading">Loading applicants...</p>
            ) : applicants.length === 0 ? (
                <div className="applicants-empty">
                    <p>No applicants yet.</p>
                    <span>Share your job posting to attract candidates.</span>
                </div>
            ) : (
                <>
                    <div className="applicants-table">
                        {/* Table header */}
                        <div className="applicants-table-header">
                            <span>#</span>
                            <span>Applicant</span>
                            <span>Applied</span>
                            <span>Status</span>
                            <span>Actions</span>
                        </div>

                        {paginated.map((a, index) => {
                            const statusStyle = STATUS_COLORS[a.application_status] || STATUS_COLORS.APPLIED;
                            const rowNumber = (page - 1) * APPLICANTS_PER_PAGE + index + 1;
                            return (
                                <div key={a.application_id} className="applicant-row">
                                    <span className="applicant-index">{rowNumber}</span>

                                    <div className="applicant-info">
                                        <span className="applicant-name">
                                            {a.first_name} {a.last_name}
                                        </span>
                                        {a.email && <span className="applicant-email">{a.email}</span>}
                                        {a.profile_name && (
                                            <span className="applicant-profile-tag">{a.profile_name}</span>
                                        )}
                                    </div>

                                    <span className="applicant-date">{formatDate(a.applied_at)}</span>

                                    <span
                                        className="applicant-status-badge"
                                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                                    >
                                        {a.application_status}
                                    </span>

                                    <div className="applicant-actions">
                                        <button
                                            className="action-btn accept-btn"
                                            onClick={() => updateStatus(a.application_id, "ACCEPTED")}
                                            disabled={a.application_status === "ACCEPTED" || a.application_status === "WITHDRAWN"}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            className="action-btn review-btn"
                                            onClick={() => updateStatus(a.application_id, "IN_REVIEW")}
                                            disabled={
                                                a.application_status === "REJECTED" ||
                                                a.application_status === "ACCEPTED" ||
                                                a.application_status === "IN_REVIEW" ||
                                                a.application_status === "WITHDRAWN"
                                            }
                                        >
                                            In Review
                                        </button>
                                        <button
                                            className="action-btn reject-btn"
                                            onClick={() => updateStatus(a.application_id, "REJECTED")}
                                            disabled={
                                                a.application_status === "REJECTED" ||
                                                a.application_status === "ACCEPTED" ||
                                                a.application_status === "WITHDRAWN"
                                            }
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="applicants-pagination">
                            <button
                                className="appl-page-btn"
                                onClick={() => setPage((p) => p - 1)}
                                disabled={page === 1}
                            >
                                &lt; Prev
                            </button>
                            <span className="appl-page-indicator">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                className="appl-page-btn"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page === totalPages}
                            >
                                Next &gt;
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ApplicantsPage;
