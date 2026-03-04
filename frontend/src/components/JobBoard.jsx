import "../styles/JobBoard.css";
import CalendarIcon from "../assets/images/CalendarIcon.png";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import ChevronRight from "../assets/images/ChevronRight.png";
import DollarSign from "../assets/images/DollarSign.png";
import FiltersIcon from "../assets/images/FiltersIcon.png";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import JobDetails from "./JobDetails";
import axios from "axios";
import { useUser } from "./UserContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Temporary", "Internship", "Casual"];
const MAX_RATE = 100;

// ── Dual Range Slider (uncontrolled refs — no re-render on drag) ──────────────
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

// ── Filter Dropdowns (defined outside JobBoard to prevent remount on re-render) ──

const LocationDropdown = ({ values, onUpdate, onClear, onApply }) => (
  <div className="filter-dropdown">
    <h4>Location</h4>
    <p className="location-note">
      Location-based search coming soon. Enter manually to filter by city, province or postal code.
    </p>
    <div className="location-inputs">
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

const JobTypeDropdown = ({ selected, onUpdate, onClear, onApply }) => (
  <div className="filter-dropdown">
    <h4>Job Type</h4>
    <div className="job-type-grid">
      {JOB_TYPES.map((type) => (
        <button
          key={type}
          className={`job-type-pill ${selected === type ? "selected" : ""}`}
          onClick={() => onUpdate("jobType", selected === type ? "" : type)}
        >
          {type}
        </button>
      ))}
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

// PayDropdown needs local state so stays as a component but defined outside
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

// ── JobBoard ──────────────────────────────────────────────────────────────────
const JobBoard = () => {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [jobDetails, setJobDetails] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applying, setApplying] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Which dropdown is open
  const [openFilter, setOpenFilter] = useState(null);
  const filterBarRef = useRef(null);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [pendingFilters, setPendingFilters] = useState({
    city: "",
    province: "",
    postalCode: "",
    jobType: "",
    hourlyRateMin: 0,
    hourlyRateMax: MAX_RATE,
    startFrom: "",
    startTo: "",
    endFrom: "",
    endTo: "",
  });

  // Applied filters (these trigger API calls)
  const [appliedFilters, setAppliedFilters] = useState({});

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Fetch jobs ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const params = { page, perPage, ...appliedFilters };
        if (user?.id && !user?.isbusiness) {
          params.currentUserId = user.id;
        }
        const res = await axios.get(`/api/all-jobs`, { params, withCredentials: true });
        const jobsFromApi = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
        setJobs(jobsFromApi);
        setTotalPages(res.data?.pagination?.totalPages || 1);
      } catch (error) {
        console.error("Error fetching all jobs:", error);
        setJobs([]);
        setTotalPages(1);
      }
    };
    fetchJobs();
  }, [refresh, page, perPage, appliedFilters]);

  // ── Open details when navigated here with state (e.g. quick apply)
  useEffect(() => {
    if (location.state?.openJobId && jobs.length) {
      const match = jobs.find((j) => j.job_id.toString() === location.state.openJobId.toString());
      if (match) {
        setJobDetails(match);
        // remove state so re-visiting /find-gigs doesn't reopen automatically
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.state, jobs, navigate]);

  // ── Fetch worker profiles ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchWorkerProfiles = async () => {
      try {
        const res = await axios.get(`/api/profile/worker-profiles/${user.id}`, {
          withCredentials: true,
        });
        setSelectedWorkerId(
          Array.isArray(res.data) && res.data.length > 0 ? res.data[0].id : null
        );
      } catch (err) {
        console.error("Failed to fetch worker profiles:", err);
        setSelectedWorkerId(null);
      }
    };

    if (user?.id && !user?.isbusiness) fetchWorkerProfiles();
    else setSelectedWorkerId(null);
  }, [user]);

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  const toggleFilter = (name) =>
    setOpenFilter((prev) => (prev === name ? null : name));

  const updatePending = (key, value) =>
    setPendingFilters((prev) => ({ ...prev, [key]: value }));

  const applyFilter = (keys, overrides = {}) => {
    const newApplied = { ...appliedFilters };
    keys.forEach((key) => {
      const val = overrides[key] !== undefined ? overrides[key] : pendingFilters[key];
      if (val !== "" && val !== null && val !== undefined) {
        if (key === "hourlyRateMin" && val === 0) return;
        if (key === "hourlyRateMax" && val === MAX_RATE) return;
        newApplied[key] = val;
      } else {
        delete newApplied[key];
      }
    });
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
      else resetPending[key] = "";
    });
    setPendingFilters(resetPending);
    setAppliedFilters(newApplied);
    setPage(1);
  };

  const hasApplied = (keys) =>
    keys.some((k) => appliedFilters[k] != null && appliedFilters[k] !== "");

  // ── Key groups ────────────────────────────────────────────────────────────
  const locationKeys = ["city", "province", "postalCode"];
  const jobTypeKeys  = ["jobType"];
  const payKeys      = ["hourlyRateMin", "hourlyRateMax"];
  const startKeys    = ["startFrom", "startTo"];
  const endKeys      = ["endFrom", "endTo"];

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleApply = async (e) => {
    const jobId = e.target.value;
    if (!user?.id || user.isbusiness || !selectedWorkerId) return;

    if (!applying) {
      setApplying(jobs.find((job) => job.job_id.toString() === jobId));
    } else {
      try {
        await axios.post(
          `/api/apply-job/${jobId}`,
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

  const handleBack = () => {
    if (applying) setApplying(false);
    else if (jobDetails) setJobDetails(null);
  };

  const handleJobDetails = (e) =>
    setJobDetails(jobs.find((job) => job.job_id.toString() === e.target.dataset.id));

  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPage((p) => Math.min(totalPages, p + 1));

  // ── Active filter tags ────────────────────────────────────────────────────
  const renderActiveTags = () => {
    const tags = [];

    if (hasApplied(locationKeys)) {
      const parts = [appliedFilters.city, appliedFilters.province, appliedFilters.postalCode]
        .filter(Boolean).join(", ");
      tags.push(
        <span key="loc" className="active-filter-tag">
          Location: {parts}
          <button onClick={() => clearFilter(locationKeys)}>×</button>
        </span>
      );
    }

    if (hasApplied(jobTypeKeys)) {
      tags.push(
        <span key="jt" className="active-filter-tag">
          Job Type: {appliedFilters.jobType}
          <button onClick={() => clearFilter(jobTypeKeys)}>×</button>
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
          Date: {appliedFilters.startFrom || "any"} → {appliedFilters.startTo || "any"}
          <button onClick={() => clearFilter(startKeys)}>×</button>
        </span>
      );
    }

    return tags.length ? <div className="active-filters-row">{tags}</div> : null;
  };

  // ── Dropdown panels ───────────────────────────────────────────────────────
  // ── Job list ──────────────────────────────────────────────────────────────
  const listItems = jobs.length === 0 ? null : jobs.map((job) => (
    <li key={job.job_id}>
      <div className="left">
        <h2>{job.jobtitle}</h2>
        <div>
          <img src={DollarSign} alt="dollar-sign" width="22px" height="auto" />
          {job.hourlyrate}/hr
        </div>
        <div>
          <img id="calendar-icon" src={CalendarIcon} alt="calendar-icon" width="22px" height="auto" />
          {formatDateForDisplay(job.jobstart)}
        </div>
      </div>
      <div className="right">
        <img
          src={ChevronRight} alt="select-job" width="15px" height="auto"
          onClick={handleJobDetails} data-id={job.job_id}
        />
        <button
          id="apply-btn" value={job.job_id} onClick={handleApply}
          disabled={!selectedWorkerId || !!user?.isbusiness}
        >
          Apply
        </button>
      </div>
    </li>
  ));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="job-board-container">
      {!jobDetails ? (
        <div>
          <h1>Job Board</h1>

          {/* Filter bar */}
          <div className="filter-bar" ref={filterBarRef}>
            <img src={FiltersIcon} alt="filters" width="24px" height="auto" />

            <button
              className={`filter-btn ${openFilter === "location" ? "active" : ""} ${hasApplied(locationKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("location")}
            >
              Location
            </button>

            <button
              className={`filter-btn ${openFilter === "jobType" ? "active" : ""} ${hasApplied(jobTypeKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("jobType")}
            >
              Job Type{appliedFilters.jobType ? ` · ${appliedFilters.jobType}` : ""}
            </button>

            <button
              className={`filter-btn ${openFilter === "pay" ? "active" : ""} ${hasApplied(payKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("pay")}
            >
              Pay Rate
            </button>

            <button
              className={`filter-btn ${openFilter === "date" ? "active" : ""} ${hasApplied([...startKeys, ...endKeys]) ? "has-value" : ""}`}
              onClick={() => toggleFilter("date")}
            >
              Date
            </button>

            <button className="filter-btn" onClick={() => {}}>
              Skill Match
            </button>

            {/* Dropdown panels */}
            {openFilter === "location" && (
              <LocationDropdown
                values={pendingFilters}
                onUpdate={updatePending}
                onClear={() => clearFilter(locationKeys)}
                onApply={() => applyFilter(locationKeys)}
              />
            )}
            {openFilter === "jobType" && (
              <JobTypeDropdown
                selected={pendingFilters.jobType}
                onUpdate={updatePending}
                onClear={() => clearFilter(jobTypeKeys)}
                onApply={() => applyFilter(jobTypeKeys)}
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
                  applyFilter(payKeys, { hourlyRateMin: min, hourlyRateMax: max });
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
          </div>

          {/* Active filter tags */}
          {renderActiveTags()}

          {/* Job list */}
          {listItems ? (
            <>
              <ul style={{ listStyleType: "none" }}>{listItems}</ul>
              <div className="pagination-row">
                <button onClick={handlePrevPage} disabled={page <= 1}>Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={handleNextPage} disabled={page >= totalPages}>Next</button>
              </div>
            </>
          ) : (
            <div>No Gigs Available</div>
          )}
        </div>
      ) : (
        <div>
          <img
            id="back-btn" src={ChevronLeft} alt="back"
            width="45px" height="auto" onClick={handleBack}
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
                className="apply-btn" onClick={handleApply} value={applying.job_id}
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