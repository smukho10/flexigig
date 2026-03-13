import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import "../styles/ApplicantsPage.css";

const APPLICANTS_PER_PAGE = 10;

const ApplicantsPage = () => {
    const { jobId } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();

    const [applicants, setApplicants] = useState([]);
    const [jobTitle, setJobTitle] = useState(state?.job?.jobtitle || "");
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
                <h1 className="applicants-page-title">
                    Applicants {jobTitle && <span>— {jobTitle}</span>}
                </h1>
            </div>

            {loading ? (
                <p className="applicants-loading">Loading applicants...</p>
            ) : applicants.length === 0 ? (
                <p className="no-applicants">No applicants yet.</p>
            ) : (
                <>
                    <div className="applicants-table">
                        <div className="applicants-table-header">
                            <span>Name</span>
                            <span>Status</span>
                            <span>Actions</span>
                        </div>
                        {paginated.map((a) => (
                            <div key={a.application_id} className="applicant-row">
                                <span className="applicant-name">
                                    {a.first_name} {a.last_name}
                                </span>
                                <span className={`applicant-status status-${a.application_status?.toLowerCase()}`}>
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
                        ))}
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
                                {page} / {totalPages}
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
