import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import format from "date-fns/format";
import getDay from "date-fns/getDay";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/ProfileScheduler.css";
import { useUser } from "./UserContext";

const locales = {
  "en-CA": require("date-fns/locale/en-CA"),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Distinct shift colours — enough for any realistic roster
const SHIFT_COLORS = [
  "#4EBBC2", // teal (default)
  "#7C62D4", // purple
  "#E07B39", // orange
  "#3A9E6E", // green
  "#D64E88", // pink
  "#3A6FD8", // blue
  "#C4A227", // amber
  "#D04444", // red
  "#4A9BAE", // steel blue
  "#8B5E3C", // brown
];

// Extract YYYY-MM-DD from a Date object
const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Extract HH:MM from a Date object
const formatTime = (date) => {
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
};

export default function ProfileScheduler({ selectedProfileId, profiles }) {
  const { user } = useUser();
  const [view, setView] = useState(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);



  // Fetch events from DB for this user globally
  const fetchEvents = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    axios
      .get(`/api/my-calendar/${user.id}`, {
        withCredentials: true,
      })
      .then((res) => {
        const formatted = res.data.map((evt, idx) => ({
          id: evt.id,
          title: evt.title,
          start: new Date(`${evt.startdate} ${evt.starttime}`),
          end: new Date(`${evt.enddate} ${evt.endtime}`),
          colorIndex: idx % SHIFT_COLORS.length,
        }));
        setEvents(formatted);
        setFetchError(null);
      })
      .catch((err) => {
        console.error("Error fetching worker schedule:", err);
        setFetchError("Failed to load schedule.");
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, user?.id]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' | 'edit' | 'delete'
  const [currentEvent, setCurrentEvent] = useState({
    id: null,
    title: "Shift",
    start: new Date(),
    end: new Date(),
  });
  const [saving, setSaving] = useState(false);
  const [overlapError, setOverlapError] = useState("");

  // Returns true if the proposed [start, end] overlaps any existing shift
  // (excluding the event being edited, identified by excludeId)
  const hasOverlap = (start, end, excludeId = null) => {
    return events.some((evt) => {
      if (excludeId !== null && evt.id === excludeId) return false;
      // Overlap exists when: newStart < existingEnd AND newEnd > existingStart
      return start < evt.end && end > evt.start;
    });
  };

  const eventPropGetter = (event) => ({
    style: {
      backgroundColor: SHIFT_COLORS[event.colorIndex ?? 0],
      border: "none",
      borderRadius: "6px",
      color: "#fff",
      padding: "4px 8px",
      width: "100%",
      boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
    },
  });

  const handleSelectSlot = useCallback(
    ({ start, end }) => {
      if (hasOverlap(start, end)) {
        // Don't open modal – give immediate feedback via a temporary state
        setOverlapError(
          "A shift already exists in that time range. Shifts cannot overlap."
        );
        setShowModal(true);
        setModalMode("add");
        setCurrentEvent({ id: null, title: "Shift", start, end });
        return;
      }
      setOverlapError("");
      setModalMode("add");
      setCurrentEvent({ id: null, title: "Shift", start, end });
      setShowModal(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events]
  );

  const handleSelectEvent = useCallback((event) => {
    setModalMode("edit");
    setCurrentEvent({ ...event });
    setOverlapError("");
    setShowModal(true);
  }, []);

  // Save new or updated event to the database
  const handleSave = () => {
    if (currentEvent.end <= currentEvent.start) {
      setOverlapError("End time must be after start time.");
      return;
    }
    if (!user?.id) {
      setOverlapError("Session expired. Please log in again.");
      return;
    }

    // Overlap check (exclude current event when editing)
    const excludeId = modalMode === "edit" ? currentEvent.id : null;
    if (hasOverlap(currentEvent.start, currentEvent.end, excludeId)) {
      setOverlapError(
        "This shift overlaps with an existing shift. Please choose a different time."
      );
      return;
    }

    setOverlapError("");
    setSaving(true);

    const payload = {
      user_id: user.id,
      startDate: formatDate(currentEvent.start),
      endDate: formatDate(currentEvent.end),
      startTime: formatTime(currentEvent.start),
      endTime: formatTime(currentEvent.end),
      title: currentEvent.title.trim(),
    };

    if (modalMode === "add") {
      axios
        .post("/api/my-calendar", payload, { withCredentials: true })
        .then(() => {
          fetchEvents();
          setShowModal(false);
        })
        .catch((err) => {
          console.error("Error saving event:", err);
          alert("Failed to save event. Please try again.");
        })
        .finally(() => setSaving(false));
    } else {
      // Edit: delete existing then re-create with updated values
      axios
        .delete(`/api/my-calendar/${currentEvent.id}`, {
          withCredentials: true,
        })
        .then(() =>
          axios.post("/api/my-calendar", payload, {
            withCredentials: true,
          })
        )
        .then(() => {
          fetchEvents();
          setShowModal(false);
        })
        .catch((err) => {
          console.error("Error updating event:", err);
          alert("Failed to update event. Please try again.");
        })
        .finally(() => setSaving(false));
    }
  };



  const toDateTimeLocal = (date) => {
    if (!date) return "";
    const ten = (i) => (i < 10 ? "0" : "") + i;
    return `${date.getFullYear()}-${ten(date.getMonth() + 1)}-${ten(
      date.getDate()
    )}T${ten(date.getHours())}:${ten(date.getMinutes())}`;
  };

  const handleStartChange = (e) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime())) {
      setCurrentEvent({ ...currentEvent, start: d });
      setOverlapError("");
    }
  };

  const handleEndChange = (e) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime())) {
      setCurrentEvent({ ...currentEvent, end: d });
      setOverlapError("");
    }
  };

  const getModalTitle = () => {
    if (modalMode === "add") return "Add Shift";
    if (modalMode === "edit") return "Edit Shift";
    return "";
  };

  return (
    <div className="profile-scheduler">
      <div className="scheduler-header">
        <div className="scheduler-title">Schedule</div>
      </div>

      {fetchError && (
        <p style={{ color: "red", padding: "8px" }}>{fetchError}</p>
      )}
      {loading && <p style={{ padding: "8px" }}>Loading schedule...</p>}

      <div className="scheduler-calendar">
        <BigCalendar
          key={date.toString() + view + selectedProfileId}
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 1200 }}
          views={["week", "day"]}
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          popup
          step={30}
          timeslots={2}
          min={new Date(1970, 1, 1, 0, 0, 0)}
          max={new Date(1970, 1, 1, 23, 59, 59)}
          scrollToTime={new Date(1970, 1, 1, 0, 0, 0)}
          enableAutoScroll={false}
        />
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{getModalTitle()}</h3>
              <button
                className="modal-close-btn"
                onClick={() => { setShowModal(false); setOverlapError(""); }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              {overlapError && (
                <div className="shift-overlap-error">
                  <span className="shift-overlap-icon">⚠️</span> {overlapError}
                </div>
              )}

              <div className="form-group">
                <label>Start Time</label>
                <input
                  type="datetime-local"
                  value={toDateTimeLocal(currentEvent.start)}
                  onChange={handleStartChange}
                />
              </div>

              <div className="form-group">
                <label>End Time</label>
                <input
                  type="datetime-local"
                  value={toDateTimeLocal(currentEvent.end)}
                  onChange={handleEndChange}
                />
              </div>
            </div>

            <div className="modal-footer">
              <div className="modal-footer-right">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}