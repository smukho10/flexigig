import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/MyGigs.css";
import { useUser } from "./UserContext";
import CalendarIcon from "../assets/images/CalendarIcon.png";
import DollarSign from "../assets/images/DollarSign.png";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";
import MessageBubbles from "../assets/images/MessageBubbles.png";

const MyGigs = () => {
  const { user } = useUser();
  const [approvedGigs, setApprovedGigs] = useState([]);
  const [employerPhotoUrls, setEmployerPhotoUrls] = useState({});
  const [searchInput, setSearchInput] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentReviewGig, setCurrentReviewGig] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null);
  const [refresh, setRefresh] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.id) {
      axios.get(`/api/applied-jobs/${user.id}`, { withCredentials: true })
        .then(async res => {
          const gigs = res.data.jobs
            .filter(job => job.application_status !== 'APPLIED');
          setApprovedGigs(gigs);
          // Fetch employer profile photos
          const uniqueEmployerIds = [...new Set(gigs.map(g => g.employer_user_id).filter(Boolean))];
          const photoMap = {};
          await Promise.all(
            uniqueEmployerIds.map(async (employerId) => {
              try {
                const res = await axios.get(`/api/profile/view-photo-url/${employerId}`, { withCredentials: true });
                if (res.data.viewUrl) photoMap[employerId] = res.data.viewUrl;
              } catch (_) {
                // No photo — DefaultAvatar fallback used
              }
            })
          );
          setEmployerPhotoUrls(photoMap);
        })
        .catch(error => {
          console.error("Error fetching gigs:", error);
        });
    }
  }, [user?.id, refresh]);

  const openReviewModal = (gig) => {
    setCurrentReviewGig(gig);
    setShowReviewModal(true);
  };

  const handleWithdraw = async (e) => {
    const jobId = e.target.value;
    if (!withdrawing) {
      setWithdrawing(approvedGigs.find(job => job.job_id.toString() === jobId));
    } else {
      try {
        await axios.patch(
          `/api/applications/${withdrawing.application_id}/status`,
          { status: 'WITHDRAWN' },
          { withCredentials: true }
        );
        setWithdrawing(null);
        setRefresh(r => !r);
      } catch (error) {
        console.error("Failed to withdraw application:", error);
      }
    }
  };

  const handleCancelWithdraw = () => setWithdrawing(null);

  const handleReviewSubmit = async () => {
    if (!currentReviewGig) return;
    try {
      const reviewer_id = user?.id;
      const reviewee_id = currentReviewGig?.employer_user_id;
      const job_id = currentReviewGig?.job_id;

      if (!reviewer_id || !reviewee_id) return;

      const ratingToSend = rating > 0 ? rating : null;
      const textToSend = reviewComment?.trim() ? reviewComment.trim() : null;

      if (ratingToSend === null && textToSend === null) {
        handleCloseModal();
        return;
      }

      await axios.post(
        `/api/reviews/worker-to-employer`,
        { reviewer_id, reviewee_id, rating: ratingToSend, review_text: textToSend, job_id },
        { withCredentials: true }
      );

      setShowSuccessMessage(true);

      setTimeout(() => {
        setShowSuccessMessage(false);
        setShowReviewModal(false);
        setCurrentReviewGig(null);
        setRating(0);
        setHoverRating(0);
        setReviewComment("");
        setRefresh(r => !r); // re-fetch from DB so button flips to ✓ Rated
      }, 2000);
    } catch (error) {
      console.error("Error submitting review:", error);
      alert(error?.response?.data?.message || "Failed to submit review");
    }
  };

  const handleCloseModal = () => {
    setShowReviewModal(false);
    setRating(0);
    setHoverRating(0);
    setReviewComment("");
    setCurrentReviewGig(null);
    setShowSuccessMessage(false);
  };

  const findJob = () => navigate("/find-gigs");

  const formatDateForDisplay = (dateTime) => {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    return date.toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  };

  const handleEmployer = () => {};
  const handleMessage = (job) => navigate(`/messages`, { state: { partnerId: job.employer_user_id, from: '/my-gigs' } });

  const STATUS_LABELS = {
    'IN_REVIEW': 'In Review',
    'ACCEPTED': 'Accepted',
    'REJECTED': 'Rejected',
    'WITHDRAWN': 'Withdrawn',
  };

  const getGigStatusBadge = (job) => {
    if (job.status === 'completed' && job.application_status === 'ACCEPTED') {
      return <span className="completed-badge">Completed</span>;
    }
    if (job.application_status === 'ACCEPTED') {
      return <span className="approved-badge">Accepted</span>;
    }
    const label = STATUS_LABELS[job.application_status] || job.application_status;
    const cssKey = job.application_status?.toLowerCase().replace('_', '-');
    return <span className={`status-badge status-${cssKey}`}>{label}</span>;
  };

  return (
    <div className="my-gigs-container">
      <div className="header-container">
        <h1>My Gigs</h1>
        <button className="add-job-button" onClick={findJob}>+ Find a New Job</button>
      </div>
      <input
        type="text"
        className="mg-search-input"
        placeholder="Search by job title..."
        value={searchInput}
        onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }}
      />
      {(() => {
        const filteredGigs = approvedGigs.filter(job =>
          !searchInput.trim() ||
          (job.jobtitle || "").toLowerCase().includes(searchInput.trim().toLowerCase())
        );
        const totalPages = Math.max(1, Math.ceil(filteredGigs.length / ITEMS_PER_PAGE));
        const pagedGigs = filteredGigs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

        if (approvedGigs.length === 0) {
          return (
            <div className="no-gigs-message">
              <p>You have no gigs at the moment.</p>
              <p>Apply for jobs to see them here once they are reviewed!</p>
            </div>
          );
        }

        if (filteredGigs.length === 0) {
          return <div className="no-gigs-message"><p>No gigs match your search.</p></div>;
        }

        return (
        <>
        <ul className="gigs-list">
          {pagedGigs.map(job => {
            const isAccepted = job.application_status === 'ACCEPTED';
            const isCompleted = job.status === 'completed';
            const isWithdrawn = job.application_status === 'WITHDRAWN';
            const myRatingForEmployer = job.my_rating_for_employer;
                        const employerRatingForMe = job.employer_rating_for_me;
                        const alreadyRated = !!job.has_reviewed_employer;
                        const renderStars = (r) =>
                          [1, 2, 3, 4, 5].map((s) => (
                            <span key={s} className={`gig-star ${s <= r ? 'gig-star--filled' : ''}`}>★</span>
                          ));

            return (
              <li key={job.job_id} className="gig-item">
                <div className="top">
                  <div className="top-left">
                    <div className="title-row">
                      <h1>{job.jobtitle}</h1>
                    </div>
                    <div className="status-badges">
                      {getGigStatusBadge(job)}
                    </div>
                    <div className="action-buttons">
                      {/* Withdraw button — hidden when already withdrawn or job completed */}
                      {!isWithdrawn && !isCompleted && (
                        <button
                          onClick={handleWithdraw}
                          value={job.job_id}
                          className="remove-btn"
                        >
                          Withdraw
                        </button>
                      )}

                      {/* Rate Employer — only for ACCEPTED + completed jobs */}
                      {isAccepted && isCompleted && (
                        alreadyRated ? (
                          <button className="rated-employer-btn" disabled>✓ Rated</button>
                        ) : (
                          <button className="rate-employer-btn" onClick={() => openReviewModal(job)}>
                            Rate Employer
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <div className="top-right">
                    <button onClick={handleEmployer}>
                      <img src={employerPhotoUrls[job.employer_user_id] || DefaultAvatar} alt="employer-avatar" className="employer-avatar" />
                      {job.business_name}
                    </button>
                    <button onClick={() => handleMessage(job)}>
                      <img src={MessageBubbles} alt="message-bubbles" width="35px" height="auto" />
                      Message
                    </button>
                  </div>
                </div>

                {isAccepted && isCompleted && (
                  <div className="gig-ratings">
                    <div className="gig-rating-row">
                      <span className="gig-rating-label">Your rating for employer:</span>
                      {myRatingForEmployer != null
                        ? <span className="gig-rating-stars">{renderStars(myRatingForEmployer)}</span>
                        : <span className="gig-rating-pending">Not rated yet</span>}
                    </div>
                    <div className="gig-rating-row">
                      <span className="gig-rating-label">Employer's rating for you:</span>
                      {employerRatingForMe != null
                        ? <span className="gig-rating-stars">{renderStars(employerRatingForMe)}</span>
                        : <span className="gig-rating-pending">Not rated yet</span>}
                    </div>
                  </div>
                )}

                <div className="bottom">
                  <div className="bottom-left">
                    <div className="details-div">
                      <h1>Job Details</h1>
                      <div>
                        <img src={DollarSign} alt="dollar-sign" width="22px" height="auto" />
                        {job.hourlyrate}/hr
                      </div>
                      <div>
                        <img id="calendar-icon" src={CalendarIcon} alt="calendar-icon" width="22px" height="auto" />
                        {formatDateForDisplay(job.jobstart)}
                      </div>
                    </div>
                    <div className="location-div">
                      <h1>Location</h1>
                      <p>{job.streetaddress}, {job.city},</p>
                      <p>{job.province} {job.postalcode}</p>
                    </div>
                  </div>
                  <div className="bottom-right">
                    <h1>Job Description</h1>
                    <div>{job.jobdescription}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>&lt; Prev</button>
            <span className="page-indicator">{currentPage} / {totalPages}</span>
            <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>Next &gt;</button>
          </div>
        )}
        </>
        );
      })()}

      {/* Withdraw confirmation modal */}
      {withdrawing && (
        <div className="comfirm-removal-container">
          <div className="prompt">
            <div className="prompt-text">
              <p>Are you sure you want to withdraw from</p>
              <p>{withdrawing.jobtitle}?</p>
            </div>
            <div className="prompt-buttons">
              <button onClick={handleCancelWithdraw}>Cancel</button>
              <button className="remove-btn" onClick={handleWithdraw} value={withdrawing.job_id}>Withdraw</button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Employer Modal */}
      {showReviewModal && (
        <div className="review-modal-overlay" onClick={handleCloseModal}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={handleCloseModal}>×</button>
            {!showSuccessMessage ? (
              <>
                <h2>Rate Your Employer</h2>
                <p className="employer-name">{currentReviewGig?.business_name}</p>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`star ${star <= (hoverRating || rating) ? 'filled' : ''}`}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                    >★</span>
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
                  <button className="cancel-btn" onClick={handleCloseModal}>Cancel</button>
                  <button className="submit-btn" onClick={handleReviewSubmit}>Submit</button>
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

export default MyGigs;