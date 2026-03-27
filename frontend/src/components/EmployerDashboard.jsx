import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useUser } from "./UserContext";
import MessageWidget from "./MessageWidget";
import "../styles/Dashboard.css";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};

const STATUS_COLORS = {
  open:      { bg: "#D1FAE5", color: "#065F46" },
  draft:     { bg: "#F3F4F6", color: "#6B7280" },
  "in-review": { bg: "#FEF3C7", color: "#92400E" },
  filled:    { bg: "#E0E7FF", color: "#3730A3" },
  completed: { bg: "#D1FAE5", color: "#065F46" },
};

const EmployerDashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [ratingSummary, setRatingSummary]   = useState(null);
  const [postedJobs, setPostedJobs]         = useState([]);
  const [loadingJobs, setLoadingJobs]       = useState(true);
  const [businessName, setBusinessName]     = useState("");

  useEffect(() => {
    if (!user?.id) return;

    // Fetch rating summary
    axios.get(`/api/reviews/${user.id}/summary`, { withCredentials: true })
      .then(res => setRatingSummary(res.data))
      .catch(err => console.error("Error fetching rating summary:", err));

    // Fetch posted jobs
    axios.get(`/api/posted-jobs/${user.id}`, { withCredentials: true })
      .then(res => {
        const jobs = res.data.jobs || [];
        setPostedJobs(jobs);
        setLoadingJobs(false);
      })
      .catch(err => {
        console.error("Error fetching posted jobs:", err);
        setLoadingJobs(false);
      });

    // Get business name
    axios.get(`/api/profile/${user.id}`, { withCredentials: true })
      .then(res => setBusinessName(res.data?.businessData?.business_name || ""))
      .catch(() => {});
  }, [user?.id]);

  const activeJobs    = postedJobs.filter(j => j.status === "open" || j.status === "in-review").length;
  const completedJobs = postedJobs.filter(j => j.status === "completed").length;
  const totalJobs     = postedJobs.length;
  const recentJobs    = [...postedJobs]
    .sort((a, b) => new Date(b.jobposteddate || 0) - new Date(a.jobposteddate || 0))
    .slice(0, 4);

  const renderStars = (avg) => {
    const rounded = Math.round(avg || 0);
    return (
      <span className="emp-dash-stars">
        {"★".repeat(rounded)}{"☆".repeat(5 - rounded)}
      </span>
    );
  };

  return (
    <div className="emp-dash">
      {/* Greeting */}
      <div className="emp-dash-greeting-row">
        <div>
          <h1 className="emp-dash-greeting">
            {getGreeting()}, <span className="emp-dash-greeting-name">{businessName || "there"}</span> 👋
          </h1>
          <p className="emp-dash-subtext">Here's what's happening today</p>
        </div>
        <button className="emp-dash-post-btn" onClick={() => navigate("/my-jobs")}>
          + Post a Job
        </button>
      </div>

      {/* Stats Row */}
      <div className="emp-dash-stats">
        <div className="emp-dash-stat-card">
          <div className="emp-dash-stat-icon emp-dash-stat-icon--blue">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="emp-dash-stat-value">{totalJobs}</p>
            <p className="emp-dash-stat-label">JOBS POSTED</p>
          </div>
        </div>

        <div className="emp-dash-stat-card">
          <div className="emp-dash-stat-icon emp-dash-stat-icon--green">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="emp-dash-stat-value">{activeJobs}</p>
            <p className="emp-dash-stat-label">ACTIVE JOBS</p>
          </div>
        </div>

        <div className="emp-dash-stat-card">
          <div className="emp-dash-stat-icon emp-dash-stat-icon--teal">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 3a9 9 0 100 18A9 9 0 0012 3z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            <p className="emp-dash-stat-value">{completedJobs}</p>
            <p className="emp-dash-stat-label">COMPLETED</p>
          </div>
        </div>

        <div className="emp-dash-stat-card">
          <div className="emp-dash-stat-icon emp-dash-stat-icon--yellow">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="emp-dash-stat-value">
              {ratingSummary && ratingSummary.ratings_count > 0
                ? Number(ratingSummary.avg_rating).toFixed(1)
                : "—"}
            </p>
            <p className="emp-dash-stat-label">AVG RATING</p>
            {ratingSummary && ratingSummary.ratings_count > 0 && (
              <p className="emp-dash-stat-sub">
                {renderStars(ratingSummary.avg_rating)} {ratingSummary.ratings_count} review{ratingSummary.ratings_count !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="emp-dash-grid">
        {/* Messages */}
        <div className="emp-dash-card">
          <Link to="/messages" style={{ textDecoration: "none", color: "inherit" }}>
            <MessageWidget />
          </Link>
        </div>

        {/* Recent Job Postings */}
        <div className="emp-dash-card">
          <div className="emp-dash-card-header">
            <h2 className="emp-dash-card-title">Recent Job Postings</h2>
            <Link to="/my-jobs" className="emp-dash-see-all">Manage →</Link>
          </div>

          {loadingJobs ? (
            <p className="emp-dash-empty">Loading...</p>
          ) : recentJobs.length === 0 ? (
            <div className="emp-dash-empty">
              <p>No jobs posted yet.</p>
              <button className="emp-dash-post-btn-sm" onClick={() => navigate("/my-jobs")}>
                Post your first job
              </button>
            </div>
          ) : (
            <div className="emp-dash-jobs-list">
              {recentJobs.map(job => {
                const statusStyle = STATUS_COLORS[job.status] || STATUS_COLORS.open;
                return (
                  <div
                    key={job.job_id}
                    className="emp-dash-job-row"
                    onClick={() => navigate(job.applicant_count > 0 ? `/my-jobs/${job.job_id}/applicants` : "/my-jobs")}
                  >
                    <div className="emp-dash-job-info">
                      <p className="emp-dash-job-title">{job.jobtitle}</p>
                      <p className="emp-dash-job-meta">
                        {job.city || job.streetaddress || "—"} · ${job.hourlyrate}/hr
                      </p>
                      <p className="emp-dash-job-date">
                        Starts {formatDate(job.jobstart)}
                      </p>
                    </div>
                    <div className="emp-dash-job-right">
                      <span
                        className="emp-dash-job-status"
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                      >
                        {job.status?.charAt(0).toUpperCase() + job.status?.slice(1)}
                      </span>
                      {job.applicant_count != null && (
                        <p className="emp-dash-job-applicants">
                          {job.applicant_count} applicant{job.applicant_count !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployerDashboard;