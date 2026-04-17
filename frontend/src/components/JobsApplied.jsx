import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/JobsApplied.css";
import { useUser } from "./UserContext";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";


const JobsApplied = () => {
  const { user } = useUser();
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [employerPhotoUrls, setEmployerPhotoUrls] = useState({});
  const [refresh, setRefresh] = useState();
  const [withdrawing, setWithdrawing] = useState();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const navigate = useNavigate();

  const ITEMS_PER_PAGE = 5;
  const filteredJobs = appliedJobs.filter(job =>
    !searchInput.trim() || job.jobtitle?.toLowerCase().includes(searchInput.trim().toLowerCase())
  );
  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
  const visibleJobs = filteredJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    const fetchAppliedJobs = async () => {
      if (user && user.id) {
        try {
          const res = await axios.get(`/api/applied-jobs/${user.id}`, { withCredentials: true });
          const sorted = [...res.data.jobs]
            .filter(job => ['APPLIED', 'IN_REVIEW'].includes(job.application_status));
          setAppliedJobs(sorted);
          setCurrentPage(1);
          // Fetch employer profile photos
          const uniqueEmployerIds = [...new Set(sorted.map(j => j.employer_user_id).filter(Boolean))];
          const photoMap = {};
          await Promise.all(
            uniqueEmployerIds.map(async (employerId) => {
              try {
                const photoRes = await axios.get(`/api/profile/view-photo-url/${employerId}`, { withCredentials: true });
                if (photoRes.data.viewUrl) photoMap[employerId] = photoRes.data.viewUrl;
              } catch (_) {
                // No photo — DefaultAvatar fallback used
              }
            })
          );
          setEmployerPhotoUrls(photoMap);
        } catch (error) {
          console.error("Error fetching applied jobs:", error);
        }
      }
    };
    fetchAppliedJobs();
  }, [user?.id, refresh]);

  const handleWithdraw = async (e) => {
    const jobId = e.target.value;
    if (!withdrawing) {
      setWithdrawing(appliedJobs.find(job => job.job_id.toString() === jobId));
    } else {
      try {
        await axios.patch(
          `/api/applications/${withdrawing.application_id}/status`,
          { status: 'WITHDRAWN' },
          { withCredentials: true }
        );
        setWithdrawing(false);
        setRefresh(!refresh);
      } catch (error) {
        console.error("Failed to withdraw application:", error);
      }
    }
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

  const handleCancel = () => {
    if (withdrawing) setWithdrawing(false);
  }

  const STATUS_LABELS = {
    'APPLIED': 'Applied',
    'IN_REVIEW': 'In Review',
    'ACCEPTED': 'Accepted',
    'CANCELLED': 'Cancelled',
    'WITHDRAWN': 'Withdrawn',
    'REJECTED': 'Rejected',
  };

  const getStatusDisplay = (status) => {
    if (!status) return null;
    const label = STATUS_LABELS[status] ?? status;
    const cssKey = status.toLowerCase().replace('_', '-');
    return <span className={`status-badge status-${cssKey}`}>{label}</span>;
  };

  return (
    <div className="jobs-applied-container">
      <div className="header-container">
        <h1>Jobs Applied</h1>
        <button className="add-job-button" onClick={findJob}>+ Find a New Job</button>
      </div>
      <input
        type="text"
        className="ja-search-input"
        placeholder="Search by job title..."
        value={searchInput}
        onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }}
      />
      <ul className="ja-list">
        {visibleJobs.map(job => (
          <li key={job.job_id} className="ja-card">
            <div className="ja-card-left">
              <div className="ja-title-row">
                <span className="ja-title">{job.jobtitle}</span>
                {getStatusDisplay(job.application_status)}
              </div>
              <div className="ja-meta-row">
                <span className="ja-business">{job.business_name}</span>
                {job.hourlyrate && <><span className="ja-sep">·</span><span className="ja-rate">${job.hourlyrate}/hr</span></>}
                {job.jobstart && <><span className="ja-sep">·</span><span className="ja-date">{formatDateForDisplay(job.jobstart)}</span></>}
              </div>
              {job.profile_name && (
                <p className="ja-applied-by">Applied with: <span>{job.profile_name}</span></p>
              )}
            </div>
            <div className="ja-card-right">
              <button className="ja-employer-btn" onClick={handleEmployer}>
                <img src={employerPhotoUrls[job.employer_user_id] || DefaultAvatar} alt="employer" className="ja-avatar" />
                <span>{job.business_name}</span>
              </button>
              <button
                className="ja-withdraw-btn"
                onClick={handleWithdraw}
                value={job.job_id}
                disabled={job.application_status === 'WITHDRAWN'}
              >
                Withdraw
              </button>
            </div>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={currentPage === 1}
          >
            &lt; Prev
          </button>
          <span className="page-indicator">{currentPage} / {totalPages}</span>
          <button
            className="page-btn"
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage === totalPages}
          >
            Next &gt;
          </button>
        </div>
      )}
      {withdrawing &&
        <div className="comfirm-removal-container">
          <div className="prompt">
            <div className="prompt-text">
              <p>Are you sure you want to withdraw from</p>
              <p>{withdrawing.jobtitle}?</p>
            </div>
            <div className="prompt-buttons">
              <button onClick={handleCancel}>Cancel</button>
              <button className="remove-btn" onClick={handleWithdraw} value={withdrawing.job_id}>Withdraw</button>
            </div>
          </div>
        </div>}
    </div>
  );
};

export default JobsApplied;