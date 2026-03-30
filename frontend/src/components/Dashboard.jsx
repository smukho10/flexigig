import React, { useState, useEffect, useRef, memo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useUser } from "./UserContext";
import ApplicationsWidget from "./ApplicationsWidget";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";
import EmployerDashboard from "./EmployerDashboard";
import "../styles/Dashboard.css";

// ── Quick Apply Modal ──────────────────────────────────────────────────────
const QuickApplyModal = ({ job, workerProfiles, onConfirm, onClose, applying }) => {
  const [selectedProfileId, setSelectedProfileId] = useState(
    workerProfiles?.[0]?.id ?? null
  );

  // Keep default in sync if profiles load after mount
  useEffect(() => {
    if (workerProfiles?.length && selectedProfileId == null) {
      setSelectedProfileId(workerProfiles[0].id);
    }
  }, [workerProfiles]);

  const hasProfiles = workerProfiles && workerProfiles.length > 0;

  return (
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button className="qa-close" onClick={onClose} aria-label="Close">×</button>

        {/* Header */}
        <h3 className="qa-title">Choose a Profile to Apply With</h3>
        <p className="qa-subtitle">Select the profile that best fits this gig.</p>

        {/* Job summary pill */}
        <div className="qa-job-pill">
          <span className="qa-job-pill-name">{job.jobtitle}</span>
          <span className="qa-job-pill-sep">·</span>
          <span className="qa-job-pill-biz">{job.business_name}</span>
          {job.distance_miles != null && (
            <>
              <span className="qa-job-pill-sep">·</span>
              <span className="qa-job-pill-dist">{Number(job.distance_miles).toFixed(1)} mi</span>
            </>
          )}
          <span className="qa-job-pill-rate">${Number(job.hourlyrate).toFixed(2)}/hr</span>
        </div>

        {/* Profile radio cards */}
        {hasProfiles ? (
          <div className="qa-profile-list">
            {workerProfiles.map((p) => {
              const isSelected = selectedProfileId === p.id;
              const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ");
              return (
                <label
                  key={p.id}
                  className={`qa-profile-card ${isSelected ? "qa-profile-card--selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="workerProfile"
                    value={p.id}
                    checked={isSelected}
                    onChange={() => setSelectedProfileId(p.id)}
                    className="qa-profile-radio"
                  />
                  <span className="qa-radio-dot" />
                  <div className="qa-profile-info">
                    <span className="qa-profile-name">{p.profile_name || fullName || "My Profile"}</span>
                    {fullName && p.profile_name && (
                      <span className="qa-profile-subname">{fullName}</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="qa-no-profiles">No worker profiles found. Please set up your profile first.</p>
        )}

        {/* Actions */}
        <div className="qa-actions">
          <button className="qa-btn-cancel" onClick={onClose} disabled={applying}>
            Cancel
          </button>
          <button
            className="qa-btn-confirm"
            onClick={() => onConfirm(job.job_id, selectedProfileId)}
            disabled={applying || !selectedProfileId || !hasProfiles}
          >
            {applying ? "Applying…" : "Confirm Application"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Recommended Gig Card ───────────────────────────────────────────────────
const RecommendedGigCard = memo(({ job, onQuickApply }) => {
  const distance =
    job.distance_km != null ? Number(job.distance_km).toFixed(1) : null;

  const startDate = job.jobstart
    ? new Date(job.jobstart).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  // New calculation for match info based on the new query output
  const matchScore = job.match_score || 0;
  const skillsMatch = job.matched_skills_count || 0;
  const expMatch = job.matched_exp_count || 0;
  const totalSkills = job.total_required_skills || 0;
  const totalExp = job.total_required_exp || 0;

  // Combine matched info for labels
  const matchedTags = [];
  if (job.matched_skills) matchedTags.push(...job.matched_skills);
  if (job.matched_experiences) matchedTags.push(...job.matched_experiences);

  // We show up to 3 tags max to avoid clutter
  const displayTags = matchedTags.slice(0, 3);
  const remainingTags = matchedTags.length - displayTags.length;

  return (
    <div className="rec-card">
      {distance != null && (
        <span className="rec-distance">{distance} km away</span>
      )}
      <p className="rec-job-title">{job.jobtitle}</p>
      <p className="rec-business">{job.business_name}</p>
      {startDate && <p className="rec-start">Starts {startDate}</p>}
      
      {/* New Match Info Section */}
      {matchScore > 0 && (
        <div className="rec-match-info">
          <span className="rec-match-text">
            {skillsMatch > 0 && `${skillsMatch}/${totalSkills} skills `}
            {expMatch > 0 && skillsMatch > 0 && "· "}
            {expMatch > 0 && `${expMatch}/${totalExp} exp `}
            matched
          </span>
          {displayTags.length > 0 && (
            <div className="rec-skill-tags">
              {displayTags.map((tag, i) => (
                <span key={i} className="rec-skill-tag">{tag}</span>
              ))}
              {remainingTags > 0 && <span className="rec-skill-tag">+{remainingTags}</span>}
            </div>
          )}
        </div>
      )}

      <div className="rec-footer">
        <span className="rec-rate">${Number(job.hourlyrate).toFixed(2)}/hr</span>
        <button className="rec-apply-btn" onClick={() => onQuickApply(job)}>
          Quick Apply
        </button>
      </div>
    </div>
  );
});

// ── Main Dashboard ─────────────────────────────────────────────────────────
const Dashboard = memo(() => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [appliedJobs, setAppliedJobs]               = useState([]);
  const [recentApplications, setRecentApplications] = useState([]);
  const [gigsCompleted, setGigsCompleted]            = useState(0);
  const [loadingStats, setLoadingStats]              = useState(true);
  const [ratingSummary, setRatingSummary]            = useState(null);
  const [conversations, setConversations]            = useState([]);
  const [partnerDetails, setPartnerDetails]          = useState({});
  const [unreadCount, setUnreadCount]                = useState(0);
  const [loadingMsgs, setLoadingMsgs]                = useState(true);
  const partnerCache = useRef({});
  const [recommendedJobs, setRecommendedJobs]        = useState([]);
  const [loadingRec, setLoadingRec]                  = useState(true);
  const [workerProfiles, setWorkerProfiles]          = useState([]);
  const [qaJob, setQaJob]                            = useState(null);
  const [applying, setApplying]                      = useState(false);
  const [applyResult, setApplyResult]                = useState(null);

  // ── Batched main fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    setLoadingStats(true);
    setLoadingMsgs(true);

    Promise.all([
      axios.get(`/api/applied-jobs/${user.id}`, { withCredentials: true }).catch(() => ({ data: { jobs: [] } })),
      axios.get(`/api/reviews/${user.id}/summary`, { withCredentials: true }).catch(() => ({ data: null })),
      axios.get(`/api/conversation-partners/${user.id}`, { withCredentials: true }).catch(() => ({ data: { partners: [] } })),
      axios.get(`/api/unread-count/${user.id}`, { withCredentials: true }).catch(() => ({ data: { unreadCount: 0 } })),
    ]).then(([jobsRes, ratingRes, convoRes, unreadRes]) => {
      const jobs = jobsRes.data.jobs || [];
      setGigsCompleted(jobs.filter((j) => j.status === "completed" && j.application_status === "ACCEPTED").length);
      setAppliedJobs(jobs);
      setRecentApplications(
      jobs
        .filter((j) => j.application_status === "ACCEPTED")
        .sort((a, b) => new Date(a.jobstart) - new Date(b.jobstart))
        .slice(0, 4)
    );
      setLoadingStats(false);
      setRatingSummary(ratingRes.data);
      setUnreadCount(unreadRes.data.unreadCount || 0);

      const partners = convoRes.data.partners || [];
      const seen = new Set();
      const unique = partners.filter((p) => { if (seen.has(p.partner_id)) return false; seen.add(p.partner_id); return true; });
      setConversations(unique);
      setLoadingMsgs(false);

      Promise.all(
        unique.filter((p) => !partnerCache.current[p.partner_id]).map((p) =>
          Promise.all([
            axios.get(`/api/user-details/${p.partner_id}`, { withCredentials: true }),
            axios.get(`/api/profile/view-photo-url/${p.partner_id}`, { withCredentials: true }).catch(() => null),
          ]).then(([detailsRes, photoRes]) => {
            const { type, firstName, lastName, businessName } = detailsRes.data.userDetails;
            const detail = { name: type === "worker" ? `${firstName} ${lastName}` : businessName, userImage: photoRes?.data?.viewUrl || null };
            partnerCache.current[p.partner_id] = detail;
            return { id: p.partner_id, detail };
          }).catch(() => null)
        )
      ).then((results) => {
        const newDetails = {};
        results.forEach((r) => { if (r) newDetails[r.id] = r.detail; });
        unique.forEach((p) => { if (partnerCache.current[p.partner_id] && !newDetails[p.partner_id]) newDetails[p.partner_id] = partnerCache.current[p.partner_id]; });
        setPartnerDetails((prev) => ({ ...prev, ...newDetails }));
      });
    });
  }, [user?.id]);

  // ── Recommended gigs + worker profiles fetch ─────────────────────────
  useEffect(() => {
    if (!user?.id || user?.isbusiness) return;
    setLoadingRec(true);

    const profilesPromise = axios
      .get(`/api/profile/worker-profiles/${user.id}`, { withCredentials: true })
      .then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : [];
      })
      .catch(() => []);

    Promise.all([profilesPromise]).then(([profiles]) => {
      setWorkerProfiles(profiles);

      return axios
        .get(`/api/recommended-jobs`, { withCredentials: true })
        .then((res) => setRecommendedJobs((res.data?.jobs || []).slice(0, 6)))
        .catch(() => setRecommendedJobs([]));
    }).finally(() => setLoadingRec(false));
  }, [user?.id, user?.isbusiness]);

  // ── Quick Apply ────────────────────────────────────────────────────────
  const handleQuickApply = useCallback((job) => { setApplyResult(null); setQaJob(job); }, []);

  const handleConfirmApply = useCallback(async (jobId, workerProfileId) => {
    if (!workerProfileId) return;
    setApplying(true);
    try {
      await axios.post(`/api/apply-job/${jobId}`, { worker_profile_id: workerProfileId }, { withCredentials: true });
      setApplyResult({ success: true, message: "Applied successfully! 🎉" });
      setRecommendedJobs((prev) => prev.filter((j) => j.job_id !== jobId));
      setQaJob(null);
    } catch (err) {
      const msg = err?.response?.data?.message === "Duplicate application not allowed."
        ? "You've already applied to this gig."
        : err?.response?.data?.message || "Something went wrong. Please try again.";
      setApplyResult({ success: false, message: msg });
      setQaJob(null);
    } finally {
      setApplying(false);
    }
  }, []);

  const handleCloseModal = useCallback(() => { setQaJob(null); setApplying(false); }, []);

  // ── Derived ────────────────────────────────────────────────────────────
  const totalApplied  = appliedJobs.filter((j) => ["APPLIED","IN_REVIEW","ACCEPTED","REJECTED","WITHDRAWN"].includes(j.application_status)).length;
  const totalAccepted = appliedJobs.filter((j) => j.application_status === "ACCEPTED").length;

  const STATUS_CONFIG = {
    APPLIED:   { label: "Applied",   cls: "badge-applied"   },
    IN_REVIEW: { label: "In Review", cls: "badge-review"    },
    ACCEPTED:  { label: "Accepted",  cls: "badge-accepted"  },
    REJECTED:  { label: "Rejected",  cls: "badge-rejected"  },
    WITHDRAWN: { label: "Withdrawn", cls: "badge-withdrawn" },
  };

  const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
  const displayName  = user?.firstname || user?.businessName || "there";
  const avgRating    = ratingSummary?.avg_rating ? Number(ratingSummary.avg_rating).toFixed(1) : null;
  const reviewCount  = ratingSummary?.ratings_count || 0;
  const renderStars  = (r) => [1,2,3,4,5].map((s) => <span key={s} className={`dash-star ${s <= Math.round(r) ? "filled" : ""}`}>★</span>);
  if (user?.isbusiness) return <EmployerDashboard />;
  return (
    <div className="dash-root">
      {qaJob && (
        <QuickApplyModal
          job={qaJob}
          workerProfiles={workerProfiles}
          onConfirm={handleConfirmApply}
          onClose={handleCloseModal}
          applying={applying}
        />
      )}

      {applyResult && (
        <div className={`dash-toast ${applyResult.success ? "dash-toast--success" : "dash-toast--error"}`}>
          {applyResult.message}
          <button className="dash-toast-close" onClick={() => setApplyResult(null)}>×</button>
        </div>
      )}

      {/* Greeting */}
      <div className="dash-topbar">
        <div className="dash-greeting">
          <span className="dash-greeting-text">{getGreeting()}, <strong>{displayName}</strong> 👋</span>
          <span className="dash-greeting-sub">{user?.isbusiness ? "Manage your gigs and workers" : "Here's what's happening today"}</span>
        </div>
        <Link to="/find-gigs" className="dash-find-btn">{user?.isbusiness ? "+ Post a Gig" : "Find Gigs"}</Link>
      </div>

      {/* Stats */}
      {!user?.isbusiness && (
        <div className="dash-stats">
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon--blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div className="dash-stat-body">
              <div className="dash-stat-value">{loadingStats ? "—" : totalApplied}</div>
              <div className="dash-stat-label">Jobs Applied</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon--green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div className="dash-stat-body">
              <div className="dash-stat-value">{loadingStats ? "—" : totalAccepted}</div>
              <div className="dash-stat-label">Accepted</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon--teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
            </div>
            <div className="dash-stat-body">
              <div className="dash-stat-value">{loadingStats ? "—" : gigsCompleted}</div>
              <div className="dash-stat-label">Gigs Completed</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon--amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div className="dash-stat-body">
              {avgRating ? (
                <>
                  <div className="dash-stat-value">{avgRating}<span className="dash-stat-stars">{renderStars(avgRating)}</span></div>
                  <div className="dash-stat-label">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</div>
                </>
              ) : (
                <>
                  <div className="dash-stat-value">—</div>
                  <div className="dash-stat-label">No reviews yet</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="dash-grid">
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">Messages{unreadCount > 0 && <span className="dash-unread-badge">{unreadCount}</span>}</span>
            <Link to="/messages" className="dash-card-link">See all →</Link>
          </div>
          <div className="dash-card-body">
            {loadingMsgs ? <div className="dash-loading">Loading messages…</div>
              : conversations.length === 0 ? <div className="dash-empty"><p>No messages yet.</p></div>
              : (
                <ul className="dash-msg-list">
                  {conversations.map((conv, i) => {
                    const partner = partnerDetails[conv.partner_id];
                    return (
                      <li key={`${conv.partner_id}-${i}`} className="dash-msg-item"
                        onClick={() => navigate("/messages", { state: { partnerId: conv.partner_id, jobId: conv.job_id || null } })}>
                        <img className="dash-msg-avatar" src={partner?.userImage || DefaultAvatar} alt="avatar" />
                        <div className="dash-msg-body">
                          <div className="dash-msg-name">{partner?.name || "Loading…"}</div>
                          {conv.job_title && <div className="dash-msg-jobtitle">{conv.job_title}</div>}
                          <div className="dash-msg-text">Tap to open chat →</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </div>

        <div className="dash-card">
          {user?.isbusiness ? (
            <>
              <div className="dash-card-header">
                <span className="dash-card-title">Applicants</span>
                <Link to="/gig-workers" className="dash-card-link">Manage →</Link>
              </div>
              <div className="dash-card-body"><ApplicationsWidget embedded /></div>
            </>
          ) : (
            <>
              <div className="dash-card-header">
                <span className="dash-card-title">Upcoming Gigs</span>
                <Link to="/my-gigs" className="dash-card-link">See all →</Link>
              </div>
              <div className="dash-card-body">
                {loadingStats ? <div className="dash-loading">Loading…</div>
                  : recentApplications.length === 0 ? (
                    <div className="dash-empty">
                      <p>No upcoming gigs yet.</p>
                      <Link to="/find-gigs" className="dash-empty-link">Find your first gig →</Link>
                    </div>
                  ) : (
                    <ul className="dash-app-list">
                      {recentApplications.map((job) => {
                        const cfg = STATUS_CONFIG[job.application_status] || { label: job.application_status, cls: "badge-applied" };
                        return (
                          <li key={job.job_id} className="dash-app-item">
                            <div className="dash-app-info">
                              <span className="dash-app-title">{job.jobtitle}</span>
                              <span className="dash-app-sub">{job.business_name} · ${job.hourlyrate}/hr</span>
                            </div>
                            <span className={`dash-badge ${cfg.cls}`}>{cfg.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recommended Gigs */}
      {!user?.isbusiness && (
        <div className="dash-rec-section">
          <div className="dash-rec-header">
            <div>
              <h2 className="dash-rec-title">Recommended For You</h2>
              <p className="dash-rec-sub">Based on your skills & experience</p>
            </div>
            <Link to="/find-gigs" className="dash-card-link">Browse all →</Link>
          </div>

          {loadingRec ? (
            <div className="dash-rec-grid">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rec-card rec-card--skeleton">
                  <div className="skeleton-line skeleton-line--short" />
                  <div className="skeleton-line skeleton-line--long" />
                  <div className="skeleton-line skeleton-line--med" />
                  <div className="skeleton-line skeleton-line--short" />
                </div>
              ))}
            </div>
          ) : recommendedJobs.length === 0 ? (
            <div className="dash-rec-empty">
              <span className="dash-rec-empty-icon">📍</span>
              <p>No recommendations found yet. Make sure your profile has skills and experience listed.</p>
              <Link to="/find-gigs" className="dash-empty-link">Browse all gigs →</Link>
            </div>
          ) : (
            <div className="dash-rec-grid">
              {recommendedJobs.map((job) => (
                <RecommendedGigCard key={job.job_id} job={job} onQuickApply={handleQuickApply} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default Dashboard;