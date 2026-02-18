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
  const [gigStatuses, setGigStatuses] = useState({});
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentReviewGig, setCurrentReviewGig] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch approved gigs from localStorage
    const fetchApprovedGigs = () => {
      const storedStatuses = JSON.parse(localStorage.getItem('jobStatuses') || '{}');
      const storedGigStatuses = JSON.parse(localStorage.getItem('gigStatuses') || '{}');
      setGigStatuses(storedGigStatuses);

      const approvedJobIds = Object.keys(storedStatuses).filter(
        jobId => storedStatuses[jobId] === 'approved'
      );

      if (user && user.id && approvedJobIds.length > 0) {
        // Fetch all applied jobs and filter for approved ones
      axios.get(`/api/applied-jobs/${user.id}`, { withCredentials: true })
          .then(res => {
            const approved = res.data.jobs.filter(job => 
              approvedJobIds.includes(job.job_id.toString())
            ).sort((a, b) => a.jobstart.localeCompare(b.jobstart));
            setApprovedGigs(approved);
          })
          .catch(error => {
            console.error("Error fetching approved gigs:", error);
          });
      } else {
        setApprovedGigs([]);
      }
    };

    fetchApprovedGigs();

    // Listen for storage changes to update when status changes
    const handleStorageChange = () => {
      fetchApprovedGigs();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, refresh]);

  const handleRemove = (jobId) => {
    // Remove from My Gigs and return to Jobs Applied
    const storedStatuses = JSON.parse(localStorage.getItem('jobStatuses') || '{}');
    delete storedStatuses[jobId];
    localStorage.setItem('jobStatuses', JSON.stringify(storedStatuses));

    // Also remove gig status
    const storedGigStatuses = JSON.parse(localStorage.getItem('gigStatuses') || '{}');
    delete storedGigStatuses[jobId];
    localStorage.setItem('gigStatuses', JSON.stringify(storedGigStatuses));

    // Trigger refresh
    window.dispatchEvent(new Event('storage'));
    setRefresh(!refresh);
  };

  const handleStatusChange = (jobId, newStatus) => {
    if (newStatus === 'completed') {
      // Update status to completed first
      const updatedGigStatuses = {
        ...gigStatuses,
        [jobId]: 'completed'
      };
      localStorage.setItem('gigStatuses', JSON.stringify(updatedGigStatuses));
      setGigStatuses(updatedGigStatuses);

      // Then open optional review modal
      const gig = approvedGigs.find(g => g.job_id === jobId);
      setCurrentReviewGig(gig);
      setShowReviewModal(true);
    } else {
      // Update status directly for "in_progress"
      const updatedGigStatuses = {
        ...gigStatuses,
        [jobId]: newStatus
      };
      localStorage.setItem('gigStatuses', JSON.stringify(updatedGigStatuses));
      setGigStatuses(updatedGigStatuses);
    }
  };

  const handleReviewSubmit = async () => {
    if (!currentReviewGig) return;

    try {
      const reviewer_id = user?.id;
      const reviewee_id = currentReviewGig?.user_id; // employer's users.id

      if (!reviewer_id || !reviewee_id) {
        console.error("Missing reviewer_id or reviewee_id", { reviewer_id, reviewee_id });
        return;
      }

      // OPTIONAL fields (but backend requires at least one)
      const ratingToSend = rating > 0 ? rating : null;
      const textToSend = reviewComment?.trim() ? reviewComment.trim() : null;

      // If both empty -> user chose not to review, just close
      if (ratingToSend === null && textToSend === null) {
        handleCloseModal();
        return;
      }

      await axios.post(
        `/api/reviews`,
        {
          reviewer_id,
          reviewee_id,
          rating: ratingToSend,
          review_text: textToSend,
        },
        { withCredentials: true }
      );

      // Show success message
      setShowSuccessMessage(true);

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
        setShowReviewModal(false);
        setRating(0);
        setHoverRating(0);
        setReviewComment("");
        setCurrentReviewGig(null);
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

  const findJob = () => {
    navigate("/find-gigs");
  };

  const formatDateForDisplay = (dateTime) => {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleEmployer = () => { };

  const handleMessage = (job) => {
    navigate(`/messages`, { state: { partnerId: job.user_id } });
  };

  const getGigStatusBadge = (jobId) => {
    const status = gigStatuses[jobId];
    if (status === 'in_progress') {
      return <span className="in-progress-badge">In Progress</span>;
    } else if (status === 'completed') {
      return <span className="completed-badge">Completed</span>;
    }
    // If no status, show Approved
    return <span className="approved-badge">Approved</span>;
  };

  return (
    <div className="my-gigs-container">
      <div className="header-container">
        <h1>My Gigs</h1>
        <button className="add-job-button" onClick={findJob}>+ Find a New Job</button>
      </div>
      {approvedGigs.length === 0 ? (
        <div className="no-gigs-message">
          <p>You have no approved gigs at the moment.</p>
          <p>Apply for jobs and get them approved to see them here!</p>
        </div>
      ) : (
        <ul className="gigs-list">
          {approvedGigs.map(job => (
            <li key={job.job_id} className="gig-item">
              <div className="top">
                <div className="top-left">
                  <div className="title-row">
                    <h1>{job.jobtitle}</h1>
                  </div>
                  <div className="status-badges">
                    {getGigStatusBadge(job.job_id)}
                  </div>
                  <div className="action-buttons">
                    <button className="remove-btn" onClick={() => handleRemove(job.job_id)}>Remove</button>
                    <select 
                      className="status-dropdown"
                      value={gigStatuses[job.job_id] || ''}
                      onChange={(e) => handleStatusChange(job.job_id, e.target.value)}
                    >
                      <option value="">Select Status</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
                <div className="top-right">
                  <button onClick={handleEmployer}>
                    <img src={DefaultAvatar} alt="employer-avatar" width="32px" height="auto" />
                    {job.business_name}
                  </button>
                  <button onClick={() => handleMessage(job)}>
                    <img src={MessageBubbles} alt="message-bubbles" width="35px" height="auto" />
                    Message
                  </button>
                </div>
              </div>
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
          ))}
        </ul>
      )}

      {/* Review Modal */}
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
                  <button className="cancel-btn" onClick={handleCloseModal}>Cancel</button>
                  <button 
                    className="submit-btn" 
                    onClick={handleReviewSubmit}
                  >
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

export default MyGigs;