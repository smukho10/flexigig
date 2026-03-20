import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import "../styles/ApplicantsPage.css";
import { useUser } from "./UserContext";

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
    const { user } = useUser();

    const [applicants, setApplicants] = useState([]);
    const [jobTitle] = useState(state?.job?.jobtitle || "");
    const [jobStatus, setJobStatus] = useState(state?.job?.status || null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    // Review modal state
    const [reviewModal, setReviewModal] = useState(false);
    const [currentApplicant, setCurrentApplicant] = useState(null);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [reviewSuccess, setReviewSuccess] = useState(false);
    const [reviewError, setReviewError] = useState("");

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

    const fetchJobStatus = async () => {
        try {
            const res = await axios.get(`/api/edit-job/${jobId}`, { withCredentials: true });
            if (res.data?.status) setJobStatus(res.data.status);
        } catch (error) {
            console.error("Error fetching job status:", error);
        }
    };

    useEffect(() => {
        fetchApplicants();
        fetchJobStatus();
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

    const openReviewModal = (applicant) => {
        setCurrentApplicant(applicant);
        setRating(0);
        setHoverRating(0);
        setReviewText("");
        setReviewSuccess(false);
        setReviewError("");
        setReviewModal(true);
    };

    const closeReviewModal = () => {
        setReviewModal(false);
        setCurrentApplicant(null);
    };

    const handleReviewSubmit = async () => {
        if (!rating && !reviewText.trim()) {
            setReviewError("Please provide a rating or review text.");
            return;
        }
        try {
            await axios.post(
                "/api/reviews/employer-to-worker",
                {
                    reviewer_id: user.id,
                    reviewee_id: currentApplicant.user_id,
                    job_id: parseInt(jobId, 10),
                    rating: rating || undefined,
                    review_text: reviewText.trim() || undefined,
                },
                { withCredentials: true }
            );
            setReviewSuccess(true);
            setTimeout(() => {
                closeReviewModal();
                fetchApplicants(); // re-fetch so has_reviewed_worker flips to true from DB
            }, 1800);
        } catch (err) {
            setReviewError(err.response?.data?.message || "Failed to submit review.");
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

    const isJobCompleted = jobStatus === "completed";

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
                    {isJobCompleted && (
                        <span className="job-completed-badge">✓ Completed</span>
                    )}
                </div>
            </div>

            {/* Summary bar */}
            {!loading && (
                <div className="applicants-summary-bar">
                    <span className="summary-count">{applicants.length} total applicant{applicants.length !== 1 ? "s" : ""}</span>
                    {isJobCompleted && (
                        <span className="summary-note">You can rate accepted workers for this completed job.</span>
                    )}
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
                            const alreadyReviewed = !!a.has_reviewed_worker; // from DB, no localStorage
                            const canRate = isJobCompleted && a.application_status === "ACCEPTED";

                            return (
                                <div key={a.application_id} className="applicant-row">
                                    <span className="applicant-index">{rowNumber}</span>

                                    <div className="applicant-info">
                                        <div className="applicant-name-row">
                                            <span className="applicant-name">
                                                {a.first_name} {a.last_name}
                                            </span>
                                            <span
                                                className="applicant-view-profile-link"
                                                onClick={() => navigate(`/applicant-profile/${a.worker_profile_id}`)}
                                            >
                                                View Profile
                                            </span>
                                        </div>
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
                                        {!isJobCompleted && (
                                            <>
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
                                                <button
                                                    className="action-btn message-btn"
                                                    onClick={() => navigate("/messages", {
                                                        state: {
                                                            partnerId: a.user_id,
                                                            jobId: parseInt(jobId),
                                                            jobTitle: jobTitle,
                                                        }
                                                    })}
                                                    disabled={a.application_status !== "IN_REVIEW"}
                                                    title={a.application_status !== "IN_REVIEW" ? "Only available when application is In Review" : ""}
                                                >
                                                    Message
                                                </button>
                                            </>
                                        )}

                                        {canRate && (
                                            alreadyReviewed ? (
                                                <button className="action-btn rated-btn" disabled>
                                                    ✓ Rated
                                                </button>
                                            ) : (
                                                <button
                                                    className="action-btn rate-worker-btn"
                                                    onClick={() => openReviewModal(a)}
                                                >
                                                    Rate Worker
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

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

            {/* Review Modal */}
            {reviewModal && (
                <div className="review-modal-overlay" onClick={closeReviewModal}>
                    <div className="review-modal" onClick={(e) => e.stopPropagation()}>
                        {reviewSuccess ? (
                            <div className="success-message">
                                <div className="success-icon">✓</div>
                                <p>Review submitted!</p>
                            </div>
                        ) : (
                            <>
                                <h2>Rate {currentApplicant?.first_name} {currentApplicant?.last_name}</h2>
                                <div className="star-rating">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className={`star ${star <= (hoverRating || rating) ? "filled" : ""}`}
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                                <textarea
                                    className="review-comment"
                                    placeholder="Write a review (optional)"
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    rows={4}
                                />
                                {reviewError && <p className="review-error">{reviewError}</p>}
                                <div className="modal-buttons">
                                    <button className="cancel-btn" onClick={closeReviewModal}>Cancel</button>
                                    <button className="submit-btn" onClick={handleReviewSubmit}>Submit</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApplicantsPage;