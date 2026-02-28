import "../styles/JobBoard.css";
import CalendarIcon from "../assets/images/CalendarIcon.png";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import ChevronRight from "../assets/images/ChevronRight.png";
import DollarSign from "../assets/images/DollarSign.png";
import FilersIcon from "../assets/images/FiltersIcon.png";
import { useEffect, useState } from "react";
import JobDetails from "./JobDetails";
import axios from "axios";
import { useUser } from "./UserContext";

const JobBoard = () => {
  const { user } = useUser();

  const [jobDetails, setJobDetails] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applying, setApplying] = useState(false);
  const [refresh, setRefresh] = useState(false);

  // NEW: selected worker sub-profile id for application
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage] = useState(10); // allowed: 10 or 20
  const [totalPages, setTotalPages] = useState(1);

  // Fetch jobs
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        // backend returns { jobs: [...], pagination: {...} }
        const res = await axios.get(`/api/all-jobs`, {
          params: { page, perPage },
          withCredentials: true,
        });

        const jobsFromApi = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
        const pagination = res.data?.pagination;

        // Keep a stable sort in the UI if you want newest first:
        const sorted = [...jobsFromApi].sort((a, b) => 
          new Date(b.jobposteddate) - new Date(a.jobposteddate)
        );

        setJobs(sorted);

        if (pagination?.totalPages) setTotalPages(pagination.totalPages);
        else setTotalPages(1);
      } catch (error) {
        console.error("Error fetching all jobs:", error);
        setJobs([]);
        setTotalPages(1);
      }
    };

    fetchJobs();
  }, [refresh, page, perPage]);

  // Fetch worker profiles and default to first profile
    useEffect(() => {
      const fetchWorkerProfiles = async () => {
        try {
          const res = await axios.get(`/api/profile/worker-profiles/${user.id}`, {
            withCredentials: true,
          });

          if (Array.isArray(res.data) && res.data.length > 0) {
            setSelectedWorkerId(res.data[0].id);
          } else {
            setSelectedWorkerId(null);
          }
        } catch (err) {
          console.error("Failed to fetch worker profiles:", err);
          setSelectedWorkerId(null);
        }
      };

      if (user?.id && !user?.isbusiness) fetchWorkerProfiles();
      else setSelectedWorkerId(null);
    }, [user]);


  // convert timestamp to readable date
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

  // TODO: handle applying filters
  const handleLocationFilter = () => {
    console.log("Location Filter");
  };
  const handleJobTypeFilter = () => {
    console.log("Job Type Filter");
  };
  const handleSkillMatchFilter = () => {
    console.log("Skill Match Filter");
  };

  // UPDATED: apply now uses gig_applications endpoint
  // 2-step UX stays the same: first click opens confirm modal, second click submits
  const handleApply = async (e) => {
    const jobId = e.target.value;

    if (!user?.id) {
      console.error("No user found. Please log in before applying.");
      return;
    }

    if (user.isbusiness) {
      console.error("Business users cannot apply for gigs.");
      return;
    }

    if (!selectedWorkerId) {
      console.error("No worker profile selected yet.");
      return;
    }

    if (!applying) {
      setApplying(jobs.find((job) => job.job_id.toString() === jobId));
    } else {
      try {
        await axios.post(
          `/api/gigs/${jobId}/apply`,
          { worker_profile_id: selectedWorkerId },
          { withCredentials: true }
        );

        if (jobDetails) setJobDetails(null);
        setApplying(false);
        setRefresh(!refresh);
      } catch (error) {
        console.error("Error applying for job:", error);
      }
    }
  };

  // handle going back from seeing job details
  const handleBack = () => {
    if (applying) setApplying(false);
    else if (jobDetails) setJobDetails(null);
  };

  // handle showing selected job details
  const handleJobDetails = (e) => {
    setJobDetails(
      jobs.find((job) => job.job_id.toString() === e.target.dataset.id)
    );
  };

  // Pagination handlers
  const handlePrevPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(totalPages, p + 1));
  };

  const listItems =
    jobs.length === 0
      ? null
      : jobs.map((job) => {
          return (
            <li key={job.job_id}>
              <div className="left">
                <h2>{job.jobtitle}</h2>
                <div>
                  <img
                    src={DollarSign}
                    alt="dollar-sign"
                    width="22px"
                    height="auto"
                  />
                  {job.hourlyrate}/hr
                </div>
                <div>
                  <img
                    id="calendar-icon"
                    src={CalendarIcon}
                    alt="calendar-icon"
                    width="22px"
                    height="auto"
                  />
                  {formatDateForDisplay(job.jobstart)}
                </div>
              </div>

              <div className="right">
                <img
                  src={ChevronRight}
                  alt="select-job"
                  width="15px"
                  height="auto"
                  onClick={handleJobDetails}
                  data-id={job.job_id}
                />

                <button
                  id="apply-btn"
                  value={job.job_id}
                  onClick={handleApply}
                  disabled={!selectedWorkerId || !!user?.isbusiness}
                >
                  Apply
                </button>
              </div>
            </li>
          );
        });

  return (
    <div className="job-board-container">
      {!jobDetails ? (
        <div>
          <h1>Job Board</h1>

          <div className="filter-bar">
            <img src={FilersIcon} alt="filters" width="24px" height="auto" />
            <button onClick={handleLocationFilter}>Location</button>
            <button onClick={handleJobTypeFilter}>Job Type</button>
            <button onClick={handleSkillMatchFilter}>Skill Match</button>
          </div>

          {listItems ? (
            <>
              <ul style={{ listStyleType: "none" }}>{listItems}</ul>

              {/* Pagination UI */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  marginTop: "16px",
                }}
              >
                <button onClick={handlePrevPage} disabled={page <= 1}>
                  Prev
                </button>
                <div>
                  Page {page} of {totalPages}
                </div>
                <button onClick={handleNextPage} disabled={page >= totalPages}>
                  Next
                </button>
              </div>
            </>
          ) : (
            <div>No Gigs Available</div>
          )}
        </div>
      ) : (
        <div>
          <img
            id="back-btn"
            src={ChevronLeft}
            alt="back"
            width="45px"
            height="auto"
            onClick={handleBack}
          />
          <JobDetails jobDetails={jobDetails} handleApply={handleApply} />
        </div>
      )}

      {applying && (
        <div className="comfirm-application-container">
          <div className="prompt">
            <div className="prompt-text">
              <p>Are you sure you want to apply to</p>
              <p>{applying.jobtitle}?</p>
            </div>
            <div className="prompt-buttons">
              <button onClick={handleBack}>Cancel</button>
              <button
                className="apply-btn"
                onClick={handleApply}
                value={applying.job_id}
                disabled={!selectedWorkerId || !!user?.isbusiness}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobBoard;