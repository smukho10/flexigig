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

  const currentProfileName =
    profiles?.find((p) => p.id === selectedProfileId)?.profile_name ||
    "Profile Scheduler";

  // Fetch events from DB for this worker profile
  const fetchEvents = useCallback(() => {
    if (!selectedProfileId) return;
    setLoading(true);
    axios
      .get(`/api/my-calendar/worker/${selectedProfileId}`, {
        withCredentials: true,
      })
      .then((res) => {
        const formatted = res.data.map((evt) => ({
          id: evt.id,
          title: evt.title,
          start: new Date(`${evt.startdate} ${evt.starttime}`),
          end: new Date(`${evt.enddate} ${evt.endtime}`),
        }));
        setEvents(formatted);
        setFetchError(null);
      })
      .catch((err) => {
        console.error("Error fetching worker schedule:", err);
        setFetchError("Failed to load schedule.");
      })
      .finally(() => setLoading(false));
  }, [selectedProfileId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' | 'edit' | 'delete'
  const [currentEvent, setCurrentEvent] = useState({
    id: null,
    title: "",
    start: new Date(),
    end: new Date(),
  });
  const [saving, setSaving] = useState(false);

  const eventPropGetter = () => ({
    style: {
      backgroundColor: "#4EBBC2",
      border: "none",
      borderRadius: "6px",
      color: "#fff",
      padding: "2px 6px",
    },
  });

  const handleSelectSlot = useCallback(({ start, end }) => {
    setModalMode("add");
    setCurrentEvent({ id: null, title: "", start, end });
    setShowModal(true);
  }, []);

  const handleSelectEvent = useCallback((event) => {
    setModalMode("edit");
    setCurrentEvent({ ...event });
    setShowModal(true);
  }, []);

  // Save new or updated event to the database
  const handleSave = () => {
    if (!currentEvent.title.trim()) {
      alert("Please enter a title.");
      return;
    }
    if (!user?.id) {
      alert("Session expired. Please log in again.");
      return;
    }

    setSaving(true);

    const payload = {
      user_id: user.id,
      worker_id: selectedProfileId,
      startDate: formatDate(currentEvent.start),
      endDate: formatDate(currentEvent.end),
      startTime: formatTime(currentEvent.start),
      endTime: formatTime(currentEvent.end),
      title: currentEvent.title.trim(),
    };

    if (modalMode === "add") {
      axios
        .post("/api/my-calendar/worker", payload, { withCredentials: true })
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
          axios.post("/api/my-calendar/worker", payload, {
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

  const handleDeleteClick = () => {
    setModalMode("delete");
  };

  const handleConfirmDelete = () => {
    setSaving(true);
    axios
      .delete(`/api/my-calendar/${currentEvent.id}`, { withCredentials: true })
      .then(() => {
        fetchEvents();
        setShowModal(false);
      })
      .catch((err) => {
        console.error("Error deleting event:", err);
        alert("Failed to delete event. Please try again.");
      })
      .finally(() => setSaving(false));
  };

  const handleTitleChange = (e) =>
    setCurrentEvent({ ...currentEvent, title: e.target.value });

  const toDateTimeLocal = (date) => {
    if (!date) return "";
    const ten = (i) => (i < 10 ? "0" : "") + i;
    return `${date.getFullYear()}-${ten(date.getMonth() + 1)}-${ten(
      date.getDate()
    )}T${ten(date.getHours())}:${ten(date.getMinutes())}`;
  };

  const handleStartChange = (e) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime())) setCurrentEvent({ ...currentEvent, start: d });
  };

  const handleEndChange = (e) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime())) setCurrentEvent({ ...currentEvent, end: d });
  };

  const getModalTitle = () => {
    if (modalMode === "add") return "Add Event";
    if (modalMode === "edit") return "Edit Event";
    if (modalMode === "delete") return "Confirm Delete";
    return "";
  };

  return (
    <div className="profile-scheduler">
      <div className="scheduler-header">
        <div className="scheduler-title">Schedule for {currentProfileName}</div>
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
          views={{ month: true, week: true, day: true }}
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
        />
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{getModalTitle()}</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Event Title</label>
                <input
                  type="text"
                  placeholder="Enter title"
                  value={currentEvent.title}
                  onChange={handleTitleChange}
                  autoFocus
                />
              </div>

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
              {modalMode === "delete" ? (
                <div
                  className="modal-footer-right"
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    className="btn btn-secondary"
                    onClick={() => setModalMode("edit")}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleConfirmDelete}
                    disabled={saving}
                  >
                    {saving ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="modal-footer-left">
                    {modalMode === "edit" && (
                      <button
                        className="btn btn-danger"
                        onClick={handleDeleteClick}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    )}
                  </div>
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
