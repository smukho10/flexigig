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
    const { user } = useUser();
    const { jobId } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();

    const [applicants, setApplicants] = useState([]);
    const [jobTitle] = useState(state?.job?.jobtitle || "");
    const [jobStatus] = useState(state?.job?.status || "");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [currentApplicant, setCurrentApplicant] = useState(null);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewComment, setReviewComment] = useState("");
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

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

    const openReviewModal = (applicant) => {
        setCurrentApplicant(applicant);
        setRating(0);
        setHoverRating(0);
        setReviewComment("");
        setShowSuccessMessage(false);
        setShowReviewModal(true);
    };

    const handleCloseModal = () => {
        setShowReviewModal(false);
        fetchApplicants();
        setCurrentApplicant(null);
        setRating(0);
        setHoverRating(0);
        setReviewComment("");
        setShowSuccessMessage(false);
    };

    const handleReviewSubmit = async () => {
        if (!currentApplicant) return;

        try {
            const reviewer_id = user?.id;
            const reviewee_id = currentApplicant?.user_id;

            if (!reviewer_id || !reviewee_id || !jobId) {
                console.error("Missing reviewer_id, reviewee_id, or job_id", {
                    reviewer_id,
                    reviewee_id,
                    jobId
                });
                return;
            }

            const ratingToSend = rating > 0 ? rating : null;
            const textToSend = reviewComment?.trim() ? reviewComment.trim() : null;

            if (ratingToSend === null && textToSend === null) {
                handleCloseModal();
                return;
            }

            await axios.post(
                `/api/reviews/employer-to-worker`,
                {
                    reviewer_id,
                    reviewee_id,
                    job_id: parseInt(jobId, 10),
                    rating: ratingToSend,
                    review_text: textToSend,
                },
                { withCredentials: true }
            );

            setShowSuccessMessage(true);

            setTimeout(() => {
                setShowSuccessMessage(false);
                setShowReviewModal(false);
                fetchApplicants();
                setRating(0);
                setHoverRating(0);
                setReviewComment("");
                setCurrentApplicant(null);
            }, 2000);
        } catch (error) {
            console.error("Error submitting review:", error);
            alert(error?.response?.data?.message || "Failed to submit review");
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const totalPages = Math.ceil(applicants.length / APPLICANTS_PER_PAGE);
    const paginated = applicants.slice((page - 1) * APPLICANTS_PER_PAGE, page * APPLICANTS_PER_PAGE);

    return (
        <div className="applicants-page-container">
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

            {!loading && (
                <div className="applicants-summary-bar">
                    <span className="summary-count">
                        {applicants.length} total applicant{applicants.length !== 1 ? "s" : ""}
                    </span>
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

                                      {jobStatus === "completed" && a.application_status === "ACCEPTED" && (
                                          <button
                                              className="action-btn rate-worker-btn"   // ← fixed
                                              onClick={() => openReviewModal(a)}
                                          >
                                              Rate Worker
                                          </button>
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

            {showReviewModal && (
                <div className="review-modal-overlay" onClick={handleCloseModal}>
                    <div className="review-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={handleCloseModal}>×</button>
                        {!showSuccessMessage ? (
                            <>
                                <h2>Rate Worker</h2>
                                <p className="employer-name">
                                    {currentApplicant?.first_name} {currentApplicant?.last_name}
                                </p>

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
                                    placeholder="Share your experience (optional)"
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    rows={4}
                                />

                                <div className="modal-buttons">
                                    <button className="cancel-btn" onClick={handleCloseModal}>
                                        Cancel
                                    </button>
                                    <button className="submit-btn" onClick={handleReviewSubmit}>
                                        Submit
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="success-message">
                                <div className="success-icon">✓</div>
                                <h2>Thanks for rating!</h2>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApplicantsPage;