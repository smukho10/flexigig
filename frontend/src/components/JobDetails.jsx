import { useState, useEffect } from "react";
import axios from "axios";
import "../styles/JobDetails.css";
import CalendarIcon from "../assets/images/CalendarIcon.png";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";
import MessageBubbles from "../assets/images/MessageBubbles.png";
import DollarSign from "../assets/images/DollarSign.png";
import { useNavigate } from "react-router-dom";

// ── Reusable tag-list display ─────────────────────────────────────────────────
const TagList = ({ items }) => {
  if (!items || items.length === 0) return <p className="no-requirements">None specified</p>;
  return (
    <div className="requirement-tags">
      {items.map((item) => (
        <span key={item} className="requirement-tag">{item}</span>
      ))}
    </div>
  );
};

const JobDetails = ({ jobDetails, handleApply }) => {
    const navigate = useNavigate();
    const [employerPhotoUrl, setEmployerPhotoUrl] = useState(null);

    useEffect(() => {
        if (!jobDetails?.user_id) return;
        axios.get(`/api/profile/view-photo-url/${jobDetails.user_id}`, { withCredentials: true })
            .then((res) => setEmployerPhotoUrl(res.data.viewUrl || null))
            .catch(() => setEmployerPhotoUrl(null));
    }, [jobDetails?.user_id]);

    const handleEmployer = () => {};

  const handleMessage = () => {
    navigate(`/messages`, {
      state: {
        partnerId: jobDetails.user_id,
        jobId: jobDetails.job_id,
        jobTitle: jobDetails.jobtitle,
      },
    });
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

  const requiredSkills     = Array.isArray(jobDetails.required_skills)     ? jobDetails.required_skills     : [];
  const requiredExperience = Array.isArray(jobDetails.required_experience) ? jobDetails.required_experience : [];

  return (
    <div className="job-details-container">
      {/* ── Top: title + apply + employer/message ── */}
      <div className="top">
        <div className="top-left">
          <h1>{jobDetails.jobtitle}</h1>
          <button onClick={handleApply} value={jobDetails.job_id}>Apply Now</button>
        </div>
        <div className="top-right">
          <button onClick={handleEmployer}>
            <img src={employerPhotoUrl || DefaultAvatar} alt="employer-avatar" width="32px" height="auto" />
            {jobDetails.business_name}
          </button>
          <button onClick={handleMessage}>
            <img src={MessageBubbles} alt="message-bubbles" width="35px" height="auto" />
            Message
          </button>
        </div>
      </div>

      {/* ── Bottom: details / location / description ── */}
      <div className="bottom">
        <div className="bottom-left">
          <div className="details-div">
            <h1>Job Details</h1>
            <div>
              <img src={DollarSign} alt="dollar-sign" width="22px" height="auto" />
              {jobDetails.hourlyrate}/hr
            </div>
            <div>
              <img id="calendar-icon" src={CalendarIcon} alt="calendar-icon" width="22px" height="auto" />
              {formatDateForDisplay(jobDetails.jobstart)}
            </div>
          </div>

          <div className="location-div">
            <h1>Location</h1>
            <p>{jobDetails.streetaddress}, {jobDetails.city},</p>
            <p>{jobDetails.province} {jobDetails.postalcode}</p>
          </div>

          {/* ── NEW: Required Skills ── */}
          <div className="requirements-div">
            <h1>Required Skills</h1>
            <TagList items={requiredSkills} />
          </div>

          {/* ── NEW: Required Experience ── */}
          <div className="requirements-div">
            <h1>Required Experience</h1>
            <TagList items={requiredExperience} />
          </div>
        </div>

        <div className="bottom-right">
          <h1>Job Description</h1>
          <div>{jobDetails.jobdescription}</div>
        </div>
      </div>
    </div>
  );
};

export default JobDetails;