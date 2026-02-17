import React, { useState, useCallback, useEffect } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import format from "date-fns/format";
import getDay from "date-fns/getDay";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/ProfileScheduler.css";

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

// Default seed events (Global, not profile specific)
const SEED_EVENTS = [
  {
    id: "evt-1",
    title: "Quarterly Project Review",
    start: new Date(new Date().setHours(9, 0, 0, 0)),
    end: new Date(new Date().setHours(12, 0, 0, 0)),
    resourceId: 1,
  },
  {
    id: "evt-2",
    title: "Team Lunch",
    start: new Date(new Date().setHours(12, 30, 0, 0)),
    end: new Date(new Date().setHours(13, 30, 0, 0)),
    resourceId: 1,
  },
];

const STORAGE_KEY = "flexigig_global_scheduler_events";

export default function ProfileScheduler() {
  const [view, setView] = useState(Views.WEEK);
  const [date, setDate] = useState(new Date());

  // Initialize events from LocalStorage or Fallback to Seed
  const [events, setEvents] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Need to parse date strings back to Date objects
        return JSON.parse(stored).map(evt => ({
          ...evt,
          start: new Date(evt.start),
          end: new Date(evt.end)
        }));
      }
    } catch (e) {
      console.error("Failed to parse events from local storage", e);
    }
    return SEED_EVENTS;
  });

  // Save to LocalStorage whenever events change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' | 'edit' | 'delete'
  const [currentEvent, setCurrentEvent] = useState({ id: null, title: "", start: new Date(), end: new Date() });

  // Event Styling
  const eventPropGetter = () => ({
    style: {
      backgroundColor: "#4EBBC2", // Unified color
      border: "none",
      borderRadius: "6px",
      color: "#fff",
      padding: "2px 6px",
    },
  });

  // Handle Slot Select (Add)
  const handleSelectSlot = useCallback(({ start, end }) => {
    setModalMode("add");
    setCurrentEvent({ id: null, title: "", start, end });
    setShowModal(true);
  }, []);

  // Handle Event Select (Edit)
  const handleSelectEvent = useCallback((event) => {
    setModalMode("edit");
    setCurrentEvent({ ...event });
    setShowModal(true);
  }, []);

  // Save Event
  const handleSave = () => {
    if (!currentEvent.title.trim()) {
      alert("Please enter a title.");
      return;
    }

    if (modalMode === "add") {
      const newEvent = {
        ...currentEvent,
        id: `evt-${Date.now()}`,
      };
      setEvents((prev) => [...prev, newEvent]);
    } else {
      setEvents((prev) => prev.map((e) => (e.id === currentEvent.id ? currentEvent : e)));
    }
    setShowModal(false);
  };

  // Trigger Delete Confirmation
  const handleDeleteClick = () => {
    setModalMode("delete");
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    setEvents((prev) => prev.filter((e) => e.id !== currentEvent.id));
    setShowModal(false);
  };

  // Input Handlers
  const handleTitleChange = (e) => setCurrentEvent({ ...currentEvent, title: e.target.value });

  const toDateTimeLocal = (date) => {
    if (!date) return "";
    const ten = (i) => (i < 10 ? "0" : "") + i;
    const YYYY = date.getFullYear();
    const MM = ten(date.getMonth() + 1);
    const DD = ten(date.getDate());
    const HH = ten(date.getHours());
    const II = ten(date.getMinutes());
    return `${YYYY}-${MM}-${DD}T${HH}:${II}`;
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
        <div className="scheduler-title">Scheduler</div>
      </div>

      <div className="scheduler-calendar">
        <BigCalendar
          key={date.toString() + view} // Force remount on navigation to fix rendering glitch
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 1200 }} // Increased height for 24h view
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

      {/* Custom Modal Overlay */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{getModalTitle()}</h3>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>&times;</button>
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
                <div className="modal-footer-right" style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => setModalMode("edit")}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={handleConfirmDelete}>
                    Confirm Delete
                  </button>
                </div>
              ) : (
                <>
                  <div className="modal-footer-left">
                    {modalMode === "edit" && (
                      <button className="btn btn-danger" onClick={handleDeleteClick}>
                        Delete
                      </button>
                    )}
                  </div>
                  <div className="modal-footer-right">
                    <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                      Save Changes
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
