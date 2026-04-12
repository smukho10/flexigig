import "../styles/JobBoard.css";
import CalendarIcon from "../assets/images/CalendarIcon.png";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import ChevronRight from "../assets/images/ChevronRight.png";
import DollarSign from "../assets/images/DollarSign.png";
import FiltersIcon from "../assets/images/FiltersIcon.png";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import JobDetails from "./JobDetails";
import ApplyModal from "./ApplyModal";
import axios from "axios";
import { useUser } from "./UserContext";

const MAX_RATE = 100;
const SKILLS = [
  "Business Management", "Communication", "Customer Service",
  "Food Safety Knowledge", "Public Security", "French",
  "Mandarin", "Cantonese", "First Aid", "Inventory Management",
  "Delivery Driving", "Basic Carpentry",
];

const EXPERIENCES = ["0-2 years", "3-5 years", "5+ years"];

const DISTANCE_OPTIONS = [
  { label: "10 miles", valueKm: 16.09 },
  { label: "20 miles", valueKm: 32.19 },
  { label: "30 miles", valueKm: 48.28 },
  { label: "50 miles", valueKm: 80.47 },
  { label: "75 miles", valueKm: 120.70 },
  { label: "100+ miles", valueKm: 160.93 },
];

const DualRangeSlider = ({ min, max, absMax, onChange }) => {
  const minRef = useRef(null);
  const maxRef = useRef(null);
  const fillRef = useRef(null);
  const localMin = useRef(min);
  const localMax = useRef(max);

  const updateFill = useCallback(() => {
    if (!fillRef.current) return;
    const pMin = (localMin.current / absMax) * 100;
    const pMax = (localMax.current / absMax) * 100;
    fillRef.current.style.left = `${pMin}%`;
    fillRef.current.style.width = `${pMax - pMin}%`;
  }, [absMax]);

  useEffect(() => {
    localMin.current = min;
    localMax.current = max;
    if (minRef.current) minRef.current.value = min;
    if (maxRef.current) maxRef.current.value = max;
    updateFill();
  }, [min, max, updateFill]);

  const handleMinInput = (e) => {
    const val = Math.min(Number(e.target.value), localMax.current - 1);
    localMin.current = val;
    e.target.value = val;
    updateFill();
  };

  const handleMaxInput = (e) => {
    const val = Math.max(Number(e.target.value), localMin.current + 1);
    localMax.current = val;
    e.target.value = val;
    updateFill();
  };

  const commit = () => onChange(localMin.current, localMax.current);

  return (
    <div className="dual-range-wrap">
      <div className="dual-range-track">
        <div className="dual-range-fill" ref={fillRef} />
      </div>
      <input
        type="range" min={0} max={absMax} defaultValue={min} ref={minRef}
        onInput={handleMinInput} onMouseUp={commit} onTouchEnd={commit}
      />
      <input
         type="range" min={0} max={absMax} defaultValue={max} ref={maxRef}
         onInput={handleMaxInput} onMouseUp={commit} onTouchEnd={commit}
      />
    </div>
  );
};

const LocationDropdown = ({
  values,
  onUpdate,
  onClear,
  onApply,
  workerCoords,
  workerRadius,
  isWorker,
  hasWorkerCoords,
}) => (
  <div className="filter-dropdown">
    <h4>Location</h4>

    <div className="location-inputs">
      {isWorker && (
        <>
          <label className="checkbox-row" style={{ marginBottom: "10px" }}>
            <input
              type="checkbox"
              checked={!!values.useDistanceFilter}
              onChange={(e) => onUpdate("useDistanceFilter", e.target.checked)}
              disabled={!hasWorkerCoords}
            />
            <span style={{ marginLeft: "8px" }}>Use my saved address</span>
          </label>

          {!hasWorkerCoords ? (
            <p className="location-note">
              Your saved address does not have coordinates yet. Update and save your
              profile address, then refresh this page to use distance filtering.
            </p>
          ) : (
            <p className="location-note">
              Using your saved profile address
              {workerCoords?.lat != null && workerCoords?.lon != null ? "" : " (coordinates unavailable)"}.
              {workerRadius ? ` Default radius: ${workerRadius} km.` : ""}
            </p>
          )}

          <label>Distance</label>
          <div className="job-type-grid">
            {DISTANCE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                className={`job-type-pill ${values.distanceLabel === option.label ? "selected" : ""}`}
                onClick={() => {
                  onUpdate("distanceKm", option.valueKm);
                  onUpdate("distanceLabel", option.label);
                }}
                disabled={!values.useDistanceFilter || !hasWorkerCoords}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}

      {!isWorker && (
        <p className="location-note">
          Distance filtering is available for worker accounts with a saved address.
        </p>
      )}

      <label>City</label>
      <input
        type="text" placeholder="e.g. Toronto"
        value={values.city}
        onChange={(e) => onUpdate("city", e.target.value)}
      />

      <label>Province</label>
      <input
        type="text" placeholder="e.g. Ontario"
        value={values.province}
        onChange={(e) => onUpdate("province", e.target.value)}
      />

      <label>Postal Code</label>
      <input
        type="text" placeholder="e.g. M5V 2T6"
        value={values.postalCode}
        onChange={(e) => onUpdate("postalCode", e.target.value)}
      />
    </div>

    <div className="filter-actions">
      <button className="filter-clear-btn" onClick={onClear}>Clear</button>
      <button className="filter-apply-btn" onClick={onApply}>Apply</button>
    </div>
  </div>
);



const DateDropdown = ({ values, onUpdate, onClear, onApply }) => (
  <div className="filter-dropdown">
    <h4>Date</h4>
    <p className="location-note">Filter jobs by start date. Fill in one or both fields.</p>
    <label>From</label>
    <input
      type="date"
      value={values.startFrom}
      onChange={(e) => onUpdate("startFrom", e.target.value)}
    />
    <label>To</label>
    <input
      type="date"
      value={values.startTo}
      onChange={(e) => onUpdate("startTo", e.target.value)}
    />
    <div className="filter-actions">
      <button className="filter-clear-btn" onClick={onClear}>Clear</button>
      <button className="filter-apply-btn" onClick={onApply}>Apply</button>
    </div>
  </div>
);

const PayDropdown = ({ initialMin, initialMax, absMax, onClear, onApply }) => {
  const [localMin, setLocalMin] = useState(initialMin);
  const [localMax, setLocalMax] = useState(initialMax);

  return (
    <div className="filter-dropdown">
      <h4>Pay Rate ($/hr)</h4>
      <DualRangeSlider
        min={localMin}
        max={localMax}
        absMax={absMax}
        onChange={(newMin, newMax) => { setLocalMin(newMin); setLocalMax(newMax); }}
      />
      <div className="pay-number-row">
        <input
          type="number" min={0} max={absMax}
          value={localMin} placeholder="Min"
          onChange={(e) => setLocalMin(Math.max(0, Math.min(Number(e.target.value), localMax - 1)))}
        />
        <span className="pay-number-sep">–</span>
        <input
          type="number" min={0} max={absMax}
          value={localMax} placeholder="Max"
          onChange={(e) => setLocalMax(Math.min(absMax, Math.max(Number(e.target.value), localMin + 1)))}
        />
        <span className="pay-number-unit">/hr</span>
      </div>
      <div className="filter-actions">
        <button className="filter-clear-btn" onClick={onClear}>Clear</button>
        <button className="filter-apply-btn" onClick={() => onApply(localMin, localMax)}>Apply</button>
      </div>
    </div>
  );
};

const SkillMatchDropdown = ({ selected, onUpdate, onClear, onApply }) => (
  <div className="filter-dropdown">
    <h4>Skill Match</h4>
    <div className="job-type-grid">
      {SKILLS.map((skill) => (
        <button
          key={skill}
          className={`job-type-pill ${selected.includes(skill) ? "selected" : ""}`}
          onClick={() => {
            const next = selected.includes(skill)
              ? selected.filter((s) => s !== skill)
              : [...selected, skill];
            onUpdate("skills", next);
          }}
        >
          {skill}
        </button>
      ))}
    </div>
    <div className="filter-actions">
      <button className="filter-clear-btn" onClick={onClear}>Clear</button>
      <button className="filter-apply-btn" onClick={onApply}>Apply</button>
    </div>
  </div>
);

const ExperienceDropdown = ({ selected, onUpdate, onClear, onApply }) => (
  <div className="filter-dropdown">
    <h4>Experience</h4>
    <div className="job-type-grid">
      {EXPERIENCES.map((exp) => (
        <button
          key={exp}
          className={`job-type-pill ${selected.includes(exp) ? "selected" : ""}`}
          onClick={() => {
            const next = selected.includes(exp)
              ? selected.filter((e) => e !== exp)
              : [...selected, exp];
            onUpdate("experience", next);
          }}
        >
          {exp}
        </button>
      ))}
    </div>
    <div className="filter-actions">
      <button className="filter-clear-btn" onClick={onClear}>Clear</button>
      <button className="filter-apply-btn" onClick={onApply}>Apply</button>
    </div>
  </div>
);

const RatingDropdown = ({ selected, onChange, onClear, onApply }) => (
  <div className="filter-dropdown">
    <h4>Rating</h4>
    <select
      className="rating-select"
      value={selected ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      <option value="">Any rating</option>
      {[1, 2, 3, 4, 5].map((star) => (
        <option key={star} value={star}>{star}+</option>
      ))}
    </select>
    <div className="filter-actions">
      <button className="filter-clear-btn" onClick={onClear}>Clear</button>
      <button className="filter-apply-btn" onClick={onApply}>Apply</button>
    </div>
  </div>
);

const JobBoard = () => {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [jobDetails, setJobDetails] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [applyJobId, setApplyJobId] = useState(null);
  const [refresh, setRefresh] = useState(false);

  const [workerCoords, setWorkerCoords] = useState(null);
  const [workerRadius, setWorkerRadius] = useState("");

  const [page, setPage] = useState(1);
  const perPage = 10;
  const [totalPages] = useState(1);

  const [openFilter, setOpenFilter] = useState(null);
  const filterBarRef = useRef(null);

  const [searchInput, setSearchInput] = useState("");
  const [minRating, setMinRating] = useState(null);
  const [pendingRating, setPendingRating] = useState(null);

  const [pendingFilters, setPendingFilters] = useState({
    city: "",
    province: "",
    postalCode: "",
    useDistanceFilter: false,
    distanceKm: "",
    distanceLabel: "",
    jobType: "",
    hourlyRateMin: 0,
    hourlyRateMax: MAX_RATE,
    startFrom: "",
    startTo: "",
    endFrom: "",
    endTo: "",
    skills: [],
    experience: [],
  });

  const [appliedFilters, setAppliedFilters] = useState({});

  useEffect(() => {
    const handleClick = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const fetchWorkerLocation = async () => {
      if (!user?.id || user?.isbusiness) {
        setWorkerCoords(null);
        setWorkerRadius("");
        return;
      }

      try {
        const res = await axios.get(`/api/profile/${user.id}`, {
          withCredentials: true,
        });

        console.log("PROFILE RESPONSE:", res.data);

        const profile = res.data?.profileData || res.data;
        console.log("PARSED PROFILE:", profile);

        if (
          profile?.latitude != null &&
          profile?.longitude != null &&
          !Number.isNaN(Number(profile.latitude)) &&
          !Number.isNaN(Number(profile.longitude))
        ) {
          setWorkerCoords({
            lat: Number(profile.latitude),
            lon: Number(profile.longitude),
          });
        } else {
          setWorkerCoords(null);
        }

        const radius =
          profile?.desired_work_radius != null &&
          profile?.desired_work_radius !== ""
            ? Number(profile.desired_work_radius)
            : "";

        setWorkerRadius(radius);

        setPendingFilters((prev) => ({
          ...prev,
          distanceKm: prev.distanceKm !== "" ? prev.distanceKm : "",
          distanceLabel: prev.distanceLabel !== "" ? prev.distanceLabel : "",
        }));
      } catch (error) {
        console.error("Error fetching worker profile coordinates:", error);
        setWorkerCoords(null);
        setWorkerRadius("");
      }
    };

    fetchWorkerLocation();
  }, [user?.id]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { skills, experience, distanceLabel, ...restFilters } = appliedFilters;
        const params = { page: 1, perPage: 1000, ...restFilters };
        if (Array.isArray(skills) && skills.length > 0) params.skills = skills;
        if (Array.isArray(experience) && experience.length > 0) params.experience = experience;
        if (user?.id && !user?.isbusiness) params.currentUserId = user.id;
        const wantsDistanceFilter = !!appliedFilters.useDistanceFilter;
        const effectiveDistance = appliedFilters.distanceKm || "";
        if (wantsDistanceFilter && workerCoords?.lat != null && workerCoords?.lon != null && effectiveDistance !== "") {
          params.originLat = workerCoords.lat;
          params.originLon = workerCoords.lon;
          params.distanceKm = effectiveDistance;
        }

        const res = await axios.get(`/api/all-jobs`, {
          params,
          paramsSerializer: (p) => {
            const parts = [];
            Object.entries(p).forEach(([key, val]) => {
              if (Array.isArray(val)) {
                val.forEach((v) => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`));
              } else if (val !== undefined && val !== null && val !== "") {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
              }
            });
            return parts.join("&");
          },
          withCredentials: true,
        });

        const jobsFromApi = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
        setJobs(jobsFromApi);
        setAllJobs(jobsFromApi);
      } catch (error) {
        console.error("Error fetching all jobs:", error);
        setJobs([]);
        setAllJobs([]);
      }
    };
    fetchJobs();
  }, [refresh, appliedFilters, workerCoords, workerRadius, user?.id]);

  useEffect(() => {
    if (location.state?.openJobId && jobs.length) {
      const match = jobs.find((j) => j.job_id.toString() === location.state.openJobId.toString());
      if (match) {
        setJobDetails(match);
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.state, jobs, navigate]);

  const formatDateForDisplay = (dateTime) => {
    if (!dateTime) return "";
    return new Date(dateTime).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDistanceForDisplay = (distanceKm) => {
    if (distanceKm == null || distanceKm === "") return "";
    return (Number(distanceKm) * 0.621371).toFixed(1);
  };

  const toggleFilter = (name) =>
    setOpenFilter((prev) => (prev === name ? null : name));

  const updatePending = (key, value) =>
    setPendingFilters((prev) => ({ ...prev, [key]: value }));

  const applyFilter = (keys, overrides = {}) => {
    const newApplied = { ...appliedFilters };

    keys.forEach((key) => {
      const val = overrides[key] !== undefined ? overrides[key] : pendingFilters[key];

      if (key === "useDistanceFilter") {
        if (val) newApplied[key] = true;
        else delete newApplied[key];
        return;
      }

      if (Array.isArray(val)) {
        if (val.length > 0) {
          newApplied[key] = val;
        } else {
          delete newApplied[key];
        }
      } else if (val !== "" && val !== null && val !== undefined) {
        if (key === "hourlyRateMin" && val === 0) return;
        if (key === "hourlyRateMax" && val === MAX_RATE) return;
        newApplied[key] = val;
      } else {
        delete newApplied[key];
      }
    });

    if (newApplied.useDistanceFilter) {
      const effectiveDistance =
        overrides.distanceKm !== undefined
          ? overrides.distanceKm
          : pendingFilters.distanceKm || "";

      const effectiveDistanceLabel =
        overrides.distanceLabel !== undefined
          ? overrides.distanceLabel
          : pendingFilters.distanceLabel || "";

      if (effectiveDistance !== "") {
        newApplied.distanceKm = effectiveDistance;
      } else {
        delete newApplied.distanceKm;
      }

      if (effectiveDistanceLabel !== "") {
        newApplied.distanceLabel = effectiveDistanceLabel;
      } else {
        delete newApplied.distanceLabel;
      }
    } else {
      delete newApplied.distanceKm;
      delete newApplied.distanceLabel;
    }

    setAppliedFilters(newApplied);
    setPage(1);
    setOpenFilter(null);
  };

  const clearFilter = (keys) => {
    const resetPending = { ...pendingFilters };
    const newApplied = { ...appliedFilters };

    keys.forEach((key) => {
      delete newApplied[key];

      if (key === "hourlyRateMin") resetPending[key] = 0;
      else if (key === "hourlyRateMax") resetPending[key] = MAX_RATE;
      else if (key === "useDistanceFilter") resetPending[key] = false;
      else if (key === "distanceKm") resetPending[key] = "";
      else if (key === "distanceLabel") resetPending[key] = "";
      else if (key === "skills" || key === "experience") resetPending[key] = [];
      else resetPending[key] = "";
    });

    setPendingFilters(resetPending);
    setAppliedFilters(newApplied);
    setPage(1);
  };

  const hasApplied = (keys) =>
  keys.some((k) => {
    const v = appliedFilters[k];
    if (Array.isArray(v)) return v.length > 0;
    return v != null && v !== "" && v !== false;
  });

  const locationKeys = [
    "city",
    "province",
    "postalCode",
    "useDistanceFilter",
    "distanceKm",
    "distanceLabel",
  ];
  const manualLocationKeys = ["city", "province", "postalCode"];
  const distanceKeys = ["useDistanceFilter", "distanceKm", "distanceLabel"];
  const payKeys = ["hourlyRateMin", "hourlyRateMax"];
  const startKeys = ["startFrom", "startTo"];
  const skillKeys = ["skills"];
  const experienceKeys = ["experience"];

  const handleApply = (e) => {
    const jobId = e.target.value;
    if (!user?.id || user.isbusiness) return;
    setApplyJobId(jobId);
  };

  const handleApplySuccess = () => {
    setJobDetails(null);
    setRefresh(!refresh);
  };

  const handleBack = () => {
    if (jobDetails) setJobDetails(null);
  };

  const handleJobDetails = (e) =>
    setJobDetails(jobs.find((job) => job.job_id.toString() === e.target.dataset.id));

  const renderActiveTags = () => {
    const tags = [];

    const hasManualLocation = hasApplied(manualLocationKeys);
    const hasDistance = !!appliedFilters.useDistanceFilter;

    if (hasManualLocation) {
      const parts = [
        appliedFilters.city,
        appliedFilters.province,
        appliedFilters.postalCode,
      ]
        .filter(Boolean)
        .join(", ");

      tags.push(
        <span key="loc" className="active-filter-tag">
          Location: {parts}
          <button onClick={() => clearFilter(manualLocationKeys)}>×</button>
        </span>
      );
    }

    if (hasDistance) {
      tags.push(
        <span key="distance" className="active-filter-tag">
          Distance: within {appliedFilters.distanceLabel || `${formatDistanceForDisplay(appliedFilters.distanceKm)} miles`}
          <button onClick={() => clearFilter(distanceKeys)}>×</button>
        </span>
      );
    }



    if (hasApplied(payKeys)) {
      const min = appliedFilters.hourlyRateMin ?? 0;
      const max = appliedFilters.hourlyRateMax ?? MAX_RATE;
      tags.push(
        <span key="pay" className="active-filter-tag">
          Pay: ${min} – ${max}/hr
          <button onClick={() => clearFilter(payKeys)}>×</button>
        </span>
      );
    }

    if (hasApplied(startKeys)) {
      tags.push(
        <span key="start" className="active-filter-tag">
          Date: {appliedFilters.startFrom || "any"} →{" "}
          {appliedFilters.startTo || "any"}
          <button onClick={() => clearFilter(startKeys)}>×</button>
        </span>
      );
    }

        if (hasApplied(skillKeys)) {
      tags.push(
        <span key="skills" className="active-filter-tag">
          Skills: {appliedFilters.skills.join(", ")}
          <button onClick={() => clearFilter(skillKeys)}>×</button>
        </span>
      );
    }

    if (hasApplied(experienceKeys)) {
      tags.push(
        <span key="experience" className="active-filter-tag">
          Experience: {appliedFilters.experience.join(", ")}
          <button onClick={() => clearFilter(experienceKeys)}>×</button>
        </span>
      );
    }

    return tags.length ? <div className="active-filters-row">{tags}</div> : null;
  };

  const allFiltered = allJobs
    .filter((job) => {
      if (searchInput.trim()) {
        const q = searchInput.trim().toLowerCase();
        if (
          !(job.jobtitle || "").toLowerCase().includes(q) &&
          !(job.jobdescription || "").toLowerCase().includes(q)
        ) return false;
      }
      if (minRating !== null) {
        const rating = parseFloat(job.employer_avg_rating);
        if (isNaN(rating) || Math.floor(rating) !== minRating) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.jobposteddate) - new Date(a.jobposteddate));

  const effectiveTotalPages = Math.max(1, Math.ceil(allFiltered.length / perPage));
  const filteredJobs = allFiltered.slice((page - 1) * perPage, page * perPage);

  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPage((p) => Math.min(effectiveTotalPages, p + 1));

  const listItems =
    filteredJobs.length === 0
      ? null
      : filteredJobs.map((job) => (
          <li key={job.job_id}>
            <div className="left">
              <h2>{job.jobtitle}</h2>
              {job.business_name && (
                <p className="job-business-name">{job.business_name}</p>
              )}
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
              {job.distance_km != null && (
                <div className="distance-row">
                  <span className="distance-dot" />
                  {formatDistanceForDisplay(job.distance_km)} miles away
                </div>
              )}
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
                disabled={!!user?.isbusiness}
              >
                Apply
              </button>
            </div>
          </li>
        ));

  const isWorker = !!user?.id && !user?.isbusiness;
  const hasWorkerCoords =
    workerCoords?.lat != null && workerCoords?.lon != null;

  return (
    <div className="job-board-container">
      {!jobDetails ? (
        <div>
          <h1>Job Board</h1>

          <div className="jb-search-row">
            <input
              type="text"
              className="jb-search-input"
              placeholder="Search by job title or description..."
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}

            />
          </div>

          <div className="filter-bar" ref={filterBarRef}>
            <img src={FiltersIcon} alt="filters" width="24px" height="auto" />

            <button
              className={`filter-btn ${
                openFilter === "location" ? "active" : ""
              } ${hasApplied(locationKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("location")}
            >
              Location{appliedFilters.distanceLabel ? ` · ${appliedFilters.distanceLabel}` : ""}
            </button>



            <button
              className={`filter-btn ${
                openFilter === "pay" ? "active" : ""
              } ${hasApplied(payKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("pay")}
            >
              Pay Rate
            </button>

            <button
              className={`filter-btn ${
                openFilter === "date" ? "active" : ""
              } ${hasApplied(startKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("date")}
            >
              Date
            </button>

            <button
              className={`filter-btn ${openFilter === "skillMatch" ? "active" : ""} ${hasApplied(skillKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("skillMatch")}
            >
              Skill Match{appliedFilters.skills?.length ? ` · ${appliedFilters.skills.length}` : ""}
            </button>

            <button
              className={`filter-btn ${openFilter === "experience" ? "active" : ""} ${hasApplied(experienceKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("experience")}
            >
              Experience{appliedFilters.experience?.length ? ` · ${appliedFilters.experience.length}` : ""}
            </button>

            <button
              className={`filter-btn ${openFilter === "rating" ? "active" : ""} ${minRating !== null ? "has-value" : ""}`}
              onClick={() => toggleFilter("rating")}
            >
                 Rating{minRating !== null ? ` · ${minRating}+` : ""}
            </button>

            {openFilter === "location" && (
              <LocationDropdown
                values={pendingFilters}
                onUpdate={updatePending}
                onClear={() => clearFilter(locationKeys)}
                onApply={() => applyFilter(locationKeys)}
                workerCoords={workerCoords}
                workerRadius={workerRadius}
                isWorker={isWorker}
                hasWorkerCoords={hasWorkerCoords}
              />
            )}



            {openFilter === "pay" && (
              <PayDropdown
                initialMin={pendingFilters.hourlyRateMin}
                initialMax={pendingFilters.hourlyRateMax}
                absMax={MAX_RATE}
                onClear={() => clearFilter(payKeys)}
                onApply={(min, max) => {
                  updatePending("hourlyRateMin", min);
                  updatePending("hourlyRateMax", max);
                  applyFilter(payKeys, {
                    hourlyRateMin: min,
                    hourlyRateMax: max,
                  });
                }}
              />
            )}

            {openFilter === "date" && (
              <DateDropdown
                values={pendingFilters}
                onUpdate={updatePending}
                onClear={() => clearFilter(startKeys)}
                onApply={() => applyFilter(startKeys)}
              />
            )}

            {openFilter === "skillMatch" && (
              <SkillMatchDropdown
                selected={pendingFilters.skills}
                onUpdate={updatePending}
                onClear={() => clearFilter(skillKeys)}
                onApply={() => applyFilter(skillKeys)}
              />
            )}

            {openFilter === "experience" && (
              <ExperienceDropdown
                selected={pendingFilters.experience}
                onUpdate={updatePending}
                onClear={() => clearFilter(experienceKeys)}
                onApply={() => applyFilter(experienceKeys)}
              />
            )}

            {openFilter === "rating" && (
              <RatingDropdown
                selected={pendingRating}
                onChange={setPendingRating}
                onClear={() => { setPendingRating(null); setMinRating(null); setOpenFilter(null); }}
                onApply={() => { setMinRating(pendingRating); setOpenFilter(null); }}
              />
            )}
          </div>

          {renderActiveTags()}

          {listItems ? (
            <>
              <ul style={{ listStyleType: "none" }}>{listItems}</ul>
              <div className="pagination-row">
                <button onClick={handlePrevPage} disabled={page <= 1}>
                  Prev
                </button>
                <span>
                  Page {page} of {effectiveTotalPages}
                </span>
                <button onClick={handleNextPage} disabled={page >= effectiveTotalPages}>
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

      {applyJobId && (
        <ApplyModal
          jobId={applyJobId}
          onClose={() => setApplyJobId(null)}
          onSuccess={handleApplySuccess}
        />
      )}
    </div>
  );
};

export default JobBoard;