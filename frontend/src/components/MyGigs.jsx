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
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch approved gigs from localStorage
    const fetchApprovedGigs = () => {
      const storedStatuses = JSON.parse(localStorage.getItem('jobStatuses') || '{}');
      const approvedJobIds = Object.keys(storedStatuses).filter(
        jobId => storedStatuses[jobId] === 'approved'
      );

      if (user && user.id && approvedJobIds.length > 0) {
        // Fetch all applied jobs and filter for approved ones
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/applied-jobs/${user.id}`, { withCredentials: true })
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
  }, [user]);

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
                  <h1>{job.jobtitle}</h1>
                  <div className="status-badge">
                    <span className="approved-badge">Approved</span>
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
    </div>
  );
};

export default MyGigs;