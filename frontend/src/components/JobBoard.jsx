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

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Temporary", "Internship", "Casual"];
const MAX_RATE = 100;

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
        type="range"
        min={0}
        max={absMax}
        defaultValue={min}
        ref={minRef}
        onInput={handleMinInput}
        onMouseUp={commit}
        onTouchEnd={commit}
      />
      <input
        type="range"
        min={0}
        max={absMax}
        defaultValue={max}
        ref={maxRef}
        onInput={handleMaxInput}
        onMouseUp={commit}
        onTouchEnd={commit}
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

          <label>Max Distance (km)</label>
          <input
            type="number"
            min="1"
            placeholder={workerRadius ? `e.g. ${workerRadius}` : "e.g. 25"}
            value={values.distanceKm}
            onChange={(e) => onUpdate("distanceKm", e.target.value)}
            disabled={!values.useDistanceFilter}
          />
        </>
      )}

      {!isWorker && (
        <p className="location-note">
          Distance filtering is available for worker accounts with a saved address.
        </p>
      )}

      <label>City</label>
      <input
        type="text"
        placeholder="e.g. Toronto"
        value={values.city}
        onChange={(e) => onUpdate("city", e.target.value)}
      />

      <label>Province</label>
      <input
        type="text"
        placeholder="e.g. Ontario"
        value={values.province}
        onChange={(e) => onUpdate("province", e.target.value)}
      />

      <label>Postal Code</label>
      <input
        type="text"
        placeholder="e.g. M5V 2T6"
        value={values.postalCode}
        onChange={(e) => onUpdate("postalCode", e.target.value)}
      />
    </div>

    <div className="filter-actions">
      <button className="filter-clear-btn" onClick={onClear}>
        Clear
      </button>
      <button className="filter-apply-btn" onClick={onApply}>
        Apply
      </button>
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
      <button className="filter-clear-btn" onClick={onClear}>
        Clear
      </button>
      <button className="filter-apply-btn" onClick={onApply}>
        Apply
      </button>
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
      <button className="filter-clear-btn" onClick={onClear}>
        Clear
      </button>
      <button className="filter-apply-btn" onClick={onApply}>
        Apply
      </button>
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
        onChange={(newMin, newMax) => {
          setLocalMin(newMin);
          setLocalMax(newMax);
        }}
      />
      <div className="pay-number-row">
        <input
          type="number"
          min={0}
          max={absMax}
          value={localMin}
          placeholder="Min"
          onChange={(e) =>
            setLocalMin(Math.max(0, Math.min(Number(e.target.value), localMax - 1)))
          }
        />
        <span className="pay-number-sep">–</span>
        <input
          type="number"
          min={0}
          max={absMax}
          value={localMax}
          placeholder="Max"
          onChange={(e) =>
            setLocalMax(Math.min(absMax, Math.max(Number(e.target.value), localMin + 1)))
          }
        />
        <span className="pay-number-unit">/hr</span>
      </div>
      <div className="filter-actions">
        <button className="filter-clear-btn" onClick={onClear}>
          Clear
        </button>
        <button className="filter-apply-btn" onClick={() => onApply(localMin, localMax)}>
          Apply
        </button>
      </div>
    </div>
  );
};

const JobBoard = () => {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [jobDetails, setJobDetails] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applyJobId, setApplyJobId] = useState(null);
  const [refresh, setRefresh] = useState(false);

  const [workerCoords, setWorkerCoords] = useState(null);
  const [workerRadius, setWorkerRadius] = useState("");

  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [openFilter, setOpenFilter] = useState(null);
  const filterBarRef = useRef(null);

  const [pendingFilters, setPendingFilters] = useState({
    city: "",
    province: "",
    postalCode: "",
    useDistanceFilter: false,
    distanceKm: "",
    jobType: "",
    hourlyRateMin: 0,
    hourlyRateMax: MAX_RATE,
    startFrom: "",
    startTo: "",
    endFrom: "",
    endTo: "",
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
          distanceKm: prev.distanceKm !== "" ? prev.distanceKm : radius || "",
        }));
      } catch (error) {
        console.error("Error fetching worker profile coordinates:", error);
        setWorkerCoords(null);
        setWorkerRadius("");
      }
    };

    fetchWorkerLocation();
  }, [user]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const params = { page, perPage, ...appliedFilters };

        if (user?.id && !user?.isbusiness) {
          params.currentUserId = user.id;
        }

        const wantsDistanceFilter = !!appliedFilters.useDistanceFilter;
        const effectiveDistance = appliedFilters.distanceKm || workerRadius || "";

        if (
          wantsDistanceFilter &&
          workerCoords?.lat != null &&
          workerCoords?.lon != null &&
          effectiveDistance !== ""
        ) {
          params.originLat = workerCoords.lat;
          params.originLon = workerCoords.lon;
          params.distanceKm = effectiveDistance;
        }

        const res = await axios.get(`/api/all-jobs`, {
          params,
          withCredentials: true,
        });

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
  }, [refresh, page, perPage, appliedFilters, workerCoords, workerRadius, user]);

  useEffect(() => {
    if (location.state?.openJobId && jobs.length) {
      const match = jobs.find(
        (j) => j.job_id.toString() === location.state.openJobId.toString()
      );
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

      if (val !== "" && val !== null && val !== undefined) {
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
          : pendingFilters.distanceKm || workerRadius || "";

      if (effectiveDistance !== "") {
        newApplied.distanceKm = effectiveDistance;
      } else {
        delete newApplied.distanceKm;
      }
    } else {
      delete newApplied.distanceKm;
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
      else if (key === "distanceKm") resetPending[key] = workerRadius || "";
      else resetPending[key] = "";
    });

    setPendingFilters(resetPending);
    setAppliedFilters(newApplied);
    setPage(1);
  };

  const hasApplied = (keys) =>
    keys.some(
      (k) =>
        appliedFilters[k] != null &&
        appliedFilters[k] !== "" &&
        appliedFilters[k] !== false
    );

  const locationKeys = [
    "city",
    "province",
    "postalCode",
    "useDistanceFilter",
    "distanceKm",
  ];
  const manualLocationKeys = ["city", "province", "postalCode"];
  const distanceKeys = ["useDistanceFilter", "distanceKm"];
  const jobTypeKeys = ["jobType"];
  const payKeys = ["hourlyRateMin", "hourlyRateMax"];
  const startKeys = ["startFrom", "startTo"];

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
    setJobDetails(
      jobs.find((job) => job.job_id.toString() === e.target.dataset.id)
    );

  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPage((p) => Math.min(totalPages, p + 1));

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
          Distance: within {appliedFilters.distanceKm || workerRadius} km
          <button onClick={() => clearFilter(distanceKeys)}>×</button>
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
          Date: {appliedFilters.startFrom || "any"} →{" "}
          {appliedFilters.startTo || "any"}
          <button onClick={() => clearFilter(startKeys)}>×</button>
        </span>
      );
    }

    return tags.length ? <div className="active-filters-row">{tags}</div> : null;
  };

  const listItems =
    jobs.length === 0
      ? null
      : jobs.map((job) => (
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
              {job.distance_km != null && (
                <div className="distance-row">
                  <span className="distance-dot" />
                  {Number(job.distance_km).toFixed(1)} km away
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

          <div className="filter-bar" ref={filterBarRef}>
            <img src={FiltersIcon} alt="filters" width="24px" height="auto" />

            <button
              className={`filter-btn ${
                openFilter === "location" ? "active" : ""
              } ${hasApplied(locationKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("location")}
            >
              Location
            </button>

            <button
              className={`filter-btn ${
                openFilter === "jobType" ? "active" : ""
              } ${hasApplied(jobTypeKeys) ? "has-value" : ""}`}
              onClick={() => toggleFilter("jobType")}
            >
              Job Type{appliedFilters.jobType ? ` · ${appliedFilters.jobType}` : ""}
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

            <button className="filter-btn" onClick={() => {}}>
              Skill Match
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
                  Page {page} of {totalPages}
                </span>
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