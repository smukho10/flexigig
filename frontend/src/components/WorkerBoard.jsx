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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [savedWorkers, setSavedWorkers] = useState(new Set());

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

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const name = getWorkerName(worker).toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase());

      const matchesSkill =
        !selectedSkill ||
        (Array.isArray(worker.skills) && worker.skills.includes(selectedSkill));

      return matchesSearch && matchesSkill;
    });
  }, [workers, selectedSkill, searchTerm]);

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
    if (worker.availability) {
      return "Available";
    }

    return "Availability not set";
  };

  const getLocationDisplay = (worker) => {
    const city = worker.worker_city || worker.city || "";
    const province = worker.worker_province || worker.province || "";

    if (city && province) {
      return `${city}, ${province}`;
    }

    if (city) {
      return city;
    }

    if (province) {
      return province;
    }

    if (Array.isArray(worker.traits) && worker.traits.length > 0) {
      return worker.traits.slice(0, 2).join(", ");
    }

    return "No location listed";
  };

  const toggleSaveWorker = (workerId) => {
    setSavedWorkers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(workerId)) {
        newSet.delete(workerId);
      } else {
        newSet.add(workerId);
      }
      return newSet;
    });
  };

  const WorkerItem = ({ worker }) => {
    return (
      <div id='workerboard-worker'>
          <div id='workerboard-worker-header'>
            <h2 id='workerboard-worker-name'>{getWorkerName(worker)}</h2>
            <Link to={`/worker/${worker.user_id || worker.id}`}>
              <img id="workerboard-arrow" src={Arrow} alt="View worker"/>
            </Link>
          </div>
          <div id='workerboard-worker-details'>
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
            <div id='workerboard-worker-actions'>
              <img
                id="workerboard-bookmark"
                src={Bookmark}
                alt="Save worker"
                onClick={() => toggleSaveWorker(worker.id)}
                style={{ opacity: savedWorkers.has(worker.id) ? 1 : 0.4 }}
              />
              <Link to={`/worker/${worker.user_id || worker.id}`}>
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
        <input
          type="text"
          placeholder="Search workers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          id="workerboard-search-input"
        />
        <div
          id='workerboard-skill-item'
          className={selectedSkill === "" ? "workerboard-skill-active" : ""}
          onClick={() => setSelectedSkill("")}
          style={{ cursor: "pointer" }}
        >
          All
        </div>
        {skills.slice(0, 3).map((skill) => (
          <div
            key={skill.skill_id}
            id='workerboard-skill-item'
            className={
              selectedSkill === skill.skill_name
                ? "workerboard-skill-active"
                : ""
            }
            onClick={() =>
              setSelectedSkill(
                selectedSkill === skill.skill_name ? "" : skill.skill_name
              )
            }
            style={{ cursor: "pointer" }}
          >
            {skill.skill_name}
          </div>
        ))}
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