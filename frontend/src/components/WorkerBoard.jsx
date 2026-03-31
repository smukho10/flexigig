import React, { useEffect, useMemo, useState } from "react";
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
  const [workers, setWorkers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedRating, setSelectedRating] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWorkerBoardData = async () => {
      try {
        setLoading(true);
        setError("");

        const [workersRes, skillsRes] = await Promise.all([
          axios.get("/api/gig-workers", { withCredentials: true }),
          axios.get("/api/get-all-skills", { withCredentials: true })
        ]);

        setWorkers(Array.isArray(workersRes.data) ? workersRes.data : []);
        setSkills(Array.isArray(skillsRes.data) ? skillsRes.data : []);
      } catch (err) {
        console.error("Error fetching worker board data:", err);
        setError("Failed to load workers.");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkerBoardData();
  }, []);

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

  const getWorkerLocationValue = (worker) => {
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

    return "";
  };

  const getWorkerRating = (worker) => {
    const rating =
      worker.avg_rating ??
      worker.average_rating ??
      worker.rating;

    if (rating == null || rating === "") {
      return null;
    }

    return Number(rating);
  };

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const matchesSkill =
        !selectedSkill ||
        (Array.isArray(worker.skills) &&
          worker.skills.some((skill) => skill === selectedSkill));

      const workerLocation = getWorkerLocationValue(worker);
      const matchesLocation =
        !selectedLocation || workerLocation === selectedLocation;

      const workerRating = getWorkerRating(worker);
      const matchesRating =
        !selectedRating ||
        (workerRating !== null && workerRating >= Number(selectedRating));

      return matchesSkill && matchesLocation && matchesRating;
    });
  }, [workers, selectedSkill, selectedLocation, selectedRating]);

  const locationOptions = useMemo(() => {
    return [...new Set(
      workers
        .map((worker) => getWorkerLocationValue(worker))
        .filter((location) => location && location.trim() !== "")
    )].sort((a, b) => a.localeCompare(b));
  }, [workers]);

  const WorkerItem = ({ worker }) => {
    return (
      <div id='workerboard-worker'>
          <div id='workerboard-worker-header'>
            <div id='workerboard-worker-title-wrap'>
              <h2 id='workerboard-worker-name'>{getWorkerName(worker)}</h2>
              <Link to={`/applicant-profile/${worker.id}`}>
                <img id="workerboard-arrow" src={Arrow} alt="View worker"/>
              </Link>
            </div>
          </div>
          <div id='workerboard-worker-details'>
            <div id='workerboard-worker-info'>
              <div id='workerboard-worker-item'>
                <img id="workerboard-icons" src={Money} alt="Pay"/>
                {getPayDisplay(worker)}
              </div>
              <div id='workerboard-worker-item'>
                <img id="workerboard-icons" src={Star} alt="Skills"/>
                {getSkillsDisplay(worker)}
              </div>
              <div id='workerboard-worker-item'>
                <img id="workerboard-icons" src={Calendar} alt="Experience"/>
                {getAvailabilityDisplay(worker)}
              </div>
              <div id='workerboard-worker-item'>
                <img id="workerboard-icons" src={Grid} alt="Location"/>
                {getLocationDisplay(worker)}
              </div>
            </div>
            <div id='workerboard-worker-actions'>
              <img id="workerboard-bookmark" src={Bookmark} alt="Save worker"/>
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
        <img id="workerboard-arrow-back" src={ArrowBack} alt=""/>
        <h1>Find Workers</h1>
      </div>
      <div id='workerboard-skill-search'>
        <img id="workerboard-filter-icon" src={SearchFilter} alt=""/>
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
      </div>

      <div id='workerboard-extra-filters'>
        <select
          id='workerboard-filter-select'
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
        >
          <option value="">All Locations</option>
          {locationOptions.map((location) => (
            <option key={location} value={location}>
              {location}
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
            setSelectedLocation("");
            setSelectedRating("");
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
        ) : filteredWorkers.length === 0 ? (
          <div>No workers found.</div>
        ) : (
          filteredWorkers.map((worker) => (
            <WorkerItem key={worker.id} worker={worker}/>
          ))
        )}
      </div>
    </div>
    )

}


export default WorkerBoard;