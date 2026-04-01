import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "./UserContext";
import axios from "axios";

import ArrowBack from "../assets/images/ChevronLeft.png";
import Arrow from "../assets/images/arrow-more.svg";
import Money from "../assets/images/gigwidget-money.svg";
import Calendar from "../assets/images/gigwidget-calendar.svg";
import Star from "../assets/images/gigwidget-star.svg";
import Grid from "../assets/images/gigwidget-grid.svg";
import Bookmark from "../assets/images/bookmark-icon.svg";
import SearchFilter from "../assets/images/search-filter-icon.svg";

import "../styles/WorkerBoard.css";

const WorkerBoard = () => {
  const { user } = useUser();
  const employerId = user?.id || user?.user_id;

  const [workers, setWorkers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [selectedRating, setSelectedRating] = useState("");
  const [selectedDistance, setSelectedDistance] = useState("");
  const [showLocationFilter, setShowLocationFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState("");

  const distanceOptions = [
    { label: "10 miles", km: 16.09 },
    { label: "20 miles", km: 32.19 },
    { label: "30 miles", km: 48.28 },
    { label: "50 miles", km: 80.47 },
    { label: "75 miles", km: 120.70 },
    { label: "100+ miles", km: 160.93 }
  ];

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const skillsRes = await axios.get("/api/get-all-skills", { withCredentials: true });
        setSkills(Array.isArray(skillsRes.data) ? skillsRes.data : []);
      } catch (err) {
        console.error("Error fetching skills:", err);
      }
    };

    fetchSkills();
  }, []);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setJobsLoading(true);

        if (!employerId) {
          setJobs([]);
          return;
        }

        const jobsRes = await axios.get(`/api/posted-jobs/${employerId}`, { withCredentials: true });
        const fetchedJobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];

        setJobs(fetchedJobs);

        if (fetchedJobs.length > 0) {
          setSelectedJobId((prev) => prev || String(fetchedJobs[0].job_id));
        } else {
          setSelectedJobId("");
        }
      } catch (err) {
        console.error("Error fetching posted jobs:", err);
        setJobs([]);
      } finally {
        setJobsLoading(false);
      }
    };

    fetchJobs();
  }, [employerId]);

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        setLoading(true);
        setError("");

        const params = {};

        if (selectedJobId) {
          params.jobId = selectedJobId;
        }

        if (selectedDistance) {
          params.distanceKm = selectedDistance;
        }

        if (selectedSkill) {
          params.skill = selectedSkill;
        }

        if (selectedRating) {
          params.rating = selectedRating;
        }

        const workersRes = await axios.get("/api/gig-workers", {
          params,
          withCredentials: true
        });

        setWorkers(Array.isArray(workersRes.data) ? workersRes.data : []);
      } catch (err) {
        console.error("Error fetching workers:", err);
        setError("Failed to load workers.");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkers();
  }, [selectedJobId, selectedDistance, selectedSkill, selectedRating]);

  const selectedJob = jobs.find((job) => String(job.job_id) === String(selectedJobId));

  const selectedJobHasCoordinates =
    selectedJob &&
    selectedJob.latitude !== null &&
    selectedJob.latitude !== undefined &&
    selectedJob.longitude !== null &&
    selectedJob.longitude !== undefined;

  const getWorkerName = (worker) => {
    return [
      worker.first_name,
      worker.firstname,
      worker.last_name,
      worker.lastname
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "Unnamed Worker";
  };

  const getPayDisplay = (worker) => {
    const payValue =
      worker.desired_pay ??
      worker.hourly_rate ??
      worker.pay_rate ??
      worker.rate;

    if (payValue == null || payValue === "") {
      return "Pay not listed";
    }

    return `$${payValue}/hr`;
  };

  const getSkillsDisplay = (worker) => {
    if (!Array.isArray(worker.skills) || worker.skills.length === 0) {
      return "No skills listed";
    }

    return worker.skills.slice(0, 2).join(", ");
  };

  const getAvailabilityDisplay = (worker) => {
    if (Array.isArray(worker.experiences) && worker.experiences.length > 0) {
      return worker.experiences.slice(0, 2).join(", ");
    }

    return "No experience listed";
  };

  const getLocationDisplay = (worker) => {
    const city =
      worker.city ||
      worker.worker_city ||
      worker.user_city ||
      "";
    const province =
      worker.province ||
      worker.worker_province ||
      worker.user_province ||
      worker.state ||
      "";

    if (city && province) {
      return `${city}, ${province}`;
    }

    if (city) {
      return city;
    }

    if (province) {
      return province;
    }

    if (worker.location) {
      return worker.location;
    }

    return "No location listed";
  };

  const getWorkerRating = (worker) => {
    const rating =
      worker.avg_rating ??
      worker.average_rating ??
      worker.worker_rating ??
      worker.rating;

    if (rating == null || rating === "") {
      return null;
    }

    return Number(rating);
  };

  const getDistanceDisplay = (worker) => {
    if (worker.distance_km == null || worker.distance_km === "") {
      return null;
    }

    const miles = Number(worker.distance_km) * 0.621371;
    return `${miles.toFixed(1)} miles away`;
  };

  const WorkerItem = ({ worker }) => {
    return (
      <div id='workerboard-worker'>
        <div id='workerboard-worker-header'>
          <div id='workerboard-worker-title-wrap'>
            <h2 id='workerboard-worker-name'>{getWorkerName(worker)}</h2>
            <Link to={`/applicant-profile/${worker.id}`}>
              <img id="workerboard-arrow" src={Arrow} alt="View worker" />
            </Link>
          </div>
        </div>
        <div id='workerboard-worker-details'>
          <div id='workerboard-worker-info'>
            <div id='workerboard-worker-item'>
              <img id="workerboard-icons" src={Money} alt="Pay" />
              {getPayDisplay(worker)}
            </div>
            <div id='workerboard-worker-item'>
              <img id="workerboard-icons" src={Star} alt="Skills" />
              {getSkillsDisplay(worker)}
            </div>
            <div id='workerboard-worker-item'>
              <img id="workerboard-icons" src={Calendar} alt="Experience" />
              {getAvailabilityDisplay(worker)}
            </div>
            <div id='workerboard-worker-item'>
              <img id="workerboard-icons" src={Grid} alt="Location" />
              {getLocationDisplay(worker)}
            </div>
            {getDistanceDisplay(worker) && (
              <div id='workerboard-worker-item'>
                <img id="workerboard-icons" src={Grid} alt="Distance" />
                {getDistanceDisplay(worker)}
              </div>
            )}
            {getWorkerRating(worker) !== null && (
              <div id='workerboard-worker-item'>
                <img id="workerboard-icons" src={Star} alt="Rating" />
                {Number(getWorkerRating(worker)).toFixed(1)} stars
              </div>
            )}
          </div>
          <div id='workerboard-worker-actions'>
            <img id="workerboard-bookmark" src={Bookmark} alt="Save worker" />
            <Link to={`/applicant-profile/${worker.id}`} id='workerboard-actions-link'>
              <div id='workerboard-actions-button'>View Profile</div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id='workerboard-content'>
      <div id='workerboard-header'>
        <img id="workerboard-arrow-back" src={ArrowBack} alt="" />
        <h1>Find Workers</h1>
      </div>

      <div id='workerboard-skill-search'>
        <div
          id='workerboard-location-toggle'
          onClick={() => setShowLocationFilter(!showLocationFilter)}
          style={{ cursor: "pointer" }}
        >
          <img
            id="workerboard-filter-icon"
            src={SearchFilter}
            alt="Location filter"
          />
          <span id='workerboard-location-toggle-text'>Location</span>
        </div>
      </div>

      {showLocationFilter && (
        <div id='workerboard-location-popup'>
          <div id='workerboard-location-popup-inner'>
            <div id='workerboard-location-popup-title'>LOCATION</div>

            <select
              id='workerboard-filter-select'
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
            >
              <option value="">
                {jobsLoading ? "Loading jobs..." : "Select Job"}
              </option>
              {jobs.map((job) => (
                <option key={job.job_id} value={job.job_id}>
                  {job.jobtitle}
                </option>
              ))}
            </select>

            {!jobsLoading && jobs.length === 0 && (
              <div style={{ marginTop: "10px" }}>
                No job postings found.
              </div>
            )}

            <div style={{ marginTop: "18px", marginBottom: "10px" }}>
              Distance
            </div>

            <div id='workerboard-distance-buttons'>
              {distanceOptions.map((option) => (
                <div
                  key={option.label}
                  id='workerboard-distance-pill'
                  onClick={() => {
                    if (!selectedJobHasCoordinates) {
                      return;
                    }

                    setSelectedDistance(String(option.km));
                  }}
                  style={{
                    cursor: selectedJobHasCoordinates ? "pointer" : "not-allowed",
                    opacity: selectedJobHasCoordinates ? 1 : 0.5,
                    fontWeight: String(selectedDistance) === String(option.km) ? "600" : "400"
                  }}
                >
                  {option.label}
                </div>
              ))}
            </div>

            {selectedJobId && !selectedJobHasCoordinates && (
              <div style={{ marginTop: "12px" }}>
                This selected job does not have a geocoded address yet.
              </div>
            )}

            <div id='workerboard-location-popup-actions'>
              <div
                id='workerboard-location-clear'
                onClick={() => {
                  setSelectedDistance("");
                  setSelectedJobId(jobs.length > 0 ? String(jobs[0].job_id) : "");
                }}
                style={{ cursor: "pointer" }}
              >
                Clear
              </div>

              <div
                id='workerboard-location-apply'
                onClick={() => setShowLocationFilter(false)}
                style={{ cursor: "pointer" }}
              >
                Apply
              </div>
            </div>
          </div>
        </div>
      )}

      <div id='workerboard-extra-filters'>
        <select
          id='workerboard-filter-select'
          value={selectedSkill}
          onChange={(e) => setSelectedSkill(e.target.value)}
        >
          <option value="">All Skills</option>
          {skills.map((skill) => (
            <option key={skill.skill_id} value={skill.skill_name}>
              {skill.skill_name}
            </option>
          ))}
        </select>

        <select
          id='workerboard-filter-select'
          value={selectedRating}
          onChange={(e) => setSelectedRating(e.target.value)}
        >
          <option value="">All Ratings</option>
          <option value="5">5+ Stars</option>
          <option value="4">4+ Stars</option>
          <option value="3">3+ Stars</option>
          <option value="2">2+ Stars</option>
          <option value="1">1+ Stars</option>
        </select>

        <div
          id='workerboard-clear-filters'
          onClick={() => {
            setSelectedSkill("");
            setSelectedRating("");
            setSelectedDistance("");
            setSelectedJobId(jobs.length > 0 ? String(jobs[0].job_id) : "");
          }}
          style={{ cursor: "pointer" }}
        >
          Clear Filters
        </div>
      </div>

      <div id='workerboard-items'>
        {loading ? (
          <div>Loading workers...</div>
        ) : error ? (
          <div>{error}</div>
        ) : workers.length === 0 ? (
          <div>No workers found.</div>
        ) : (
          workers.map((worker) => (
            <WorkerItem key={worker.id} worker={worker} />
          ))
        )}
      </div>
    </div>
  )
}

export default WorkerBoard;