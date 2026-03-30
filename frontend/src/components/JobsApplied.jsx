import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/JobsApplied.css";
import { useUser } from "./UserContext";
import CalendarIcon from "../assets/images/CalendarIcon.png";
import DollarSign from "../assets/images/DollarSign.png";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";


const JobsApplied = () => {
  const { user } = useUser();
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [employerPhotoUrls, setEmployerPhotoUrls] = useState({});
  const [refresh, setRefresh] = useState();
  const [withdrawing, setWithdrawing] = useState();
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(appliedJobs.length / ITEMS_PER_PAGE);
  const visibleJobs = appliedJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    const fetchAppliedJobs = async () => {
      if (user && user.id) {
        try {
          const res = await axios.get(`/api/applied-jobs/${user.id}`, { withCredentials: true });
          const sorted = [...res.data.jobs]
            .filter(job => ['APPLIED', 'IN_REVIEW'].includes(job.application_status))
            .sort((a, b) => a.jobstart.localeCompare(b.jobstart));
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
  }, [user, refresh]);

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
      <ul className="jobs-list">
        {visibleJobs.map(job => (
          <li key={job.job_id} className="job-item">
            <div className="top">
              <div className="top-left">
                <div className="title-row">
                  <h1>{job.jobtitle}</h1>
                  {getStatusDisplay(job.application_status)}
                </div>
                <p className="applied-by">Applied by: <span>{job.profile_name}</span></p>
                <div className="action-buttons">
                  <button
                    onClick={handleWithdraw}
                    value={job.job_id}
                    disabled={job.application_status === 'WITHDRAWN'}
                  >
                    Withdraw
                  </button>
                </div>
              </div>
              <div className="top-right">
                <button onClick={handleEmployer}>
                  <img src={employerPhotoUrls[job.employer_user_id] || DefaultAvatar} alt="employer-avatar" width="32px" height="auto" />
                  {job.business_name}
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