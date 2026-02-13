import React, { useEffect, useMemo, useState } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";

import format from "date-fns/format";
import getDay from "date-fns/getDay";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import addDays from "date-fns/addDays";
import set from "date-fns/set";

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

const ROOM_META = [
  { id: "room1", label: "Room 1", color: "#4E9BE6" },
  { id: "room2", label: "Room 2", color: "#4CAF50" },
  { id: "room3", label: "Room 3", color: "#A6CE39" },
  { id: "room4", label: "Room 4", color: "#FF8C42" },
];

const getRoomColor = (roomId) => ROOM_META.find((r) => r.id === roomId)?.color || "#4EBBC2";

const seedEventsForWeek = (baseDate, seed = 0) => {
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });

  const d = (dayOffset, hour, minute = 0) => {
    const day = addDays(weekStart, dayOffset);
    return set(day, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
  };

  const shift = seed % 3; // 0..2
  const day = (n) => (n + shift) % 7;

  return [
    { id: `seed-${seed}-1`, title: "Quarterly Project Review Meeting", start: d(day(3), 9), end: d(day(3), 15), room: "room1" },
    { id: `seed-${seed}-2`, title: "IT Group Mtg.", start: d(day(4), 10), end: d(day(4), 14, 30), room: "room2" },
    { id: `seed-${seed}-3`, title: "Interview with James", start: d(day(5), 14), end: d(day(5), 15, 30), room: "room1" },
    { id: `seed-${seed}-4`, title: "Interview with Nancy", start: d(day(6), 14), end: d(day(6), 16), room: "room4" },
    { id: `seed-${seed}-5`, title: "New Projects Planning", start: d(day(3), 15), end: d(day(3), 16), room: "room3" },
  ];
};

const normalizeRoomInput = (input) => {
  if (!input) return ROOM_META[0].id;
  const trimmed = String(input).trim().toLowerCase();

  const direct = ROOM_META.find((r) => r.label.toLowerCase() === trimmed);
  if (direct) return direct.id;

  const num = trimmed.replace("room", "").trim();
  const asNumber = parseInt(num, 10);
  if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= ROOM_META.length) {
    return `room${asNumber}`;
  }
  return ROOM_META[0].id;
};

export default function ProfileScheduler({ selectedProfileId, profiles = [] }) {
  const [view, setView] = useState(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [eventsByProfile, setEventsByProfile] = useState({});

  const profileName = useMemo(() => {
    if (!selectedProfileId) return "";
    const p = profiles.find((x) => x.id === selectedProfileId);
    return p?.profile_name || `Profile ${selectedProfileId}`;
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (!selectedProfileId) return;
    setEventsByProfile((prev) => {
      if (prev[selectedProfileId]) return prev;
      return { ...prev, [selectedProfileId]: seedEventsForWeek(new Date(), selectedProfileId) };
    });
  }, [selectedProfileId]);

  const events = eventsByProfile[selectedProfileId] || [];

  const eventPropGetter = (event) => ({
    style: {
      backgroundColor: getRoomColor(event.room),
      border: "none",
      borderRadius: "6px",
      color: "#fff",
      padding: "2px 6px",
    },
  });

  const handleSelectSlot = ({ start, end }) => {
    if (!selectedProfileId) return;

    const title = window.prompt("Add an event title (front-end demo):");
    if (!title) return;

    const roomInput = window.prompt("Choose a category: Room 1, Room 2, Room 3, Room 4", "Room 1");
    const room = normalizeRoomInput(roomInput);

    const newEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      start,
      end,
      room,
    };

    setEventsByProfile((prev) => ({
      ...prev,
      [selectedProfileId]: [...(prev[selectedProfileId] || []), newEvent],
    }));
  };

  const handleSelectEvent = (event) => {
    if (!selectedProfileId) return;
    if (!window.confirm(`Delete "${event.title}"? (front-end demo)`)) return;

    setEventsByProfile((prev) => ({
      ...prev,
      [selectedProfileId]: (prev[selectedProfileId] || []).filter((e) => e.id !== event.id),
    }));
  };

  return (
    <div className="profile-scheduler">
      <div className="scheduler-header">
        <div>
          <div className="scheduler-title">Scheduler</div>
          {profileName ? (
            <div className="scheduler-subtitle">
              Showing schedule for: <strong>{profileName}</strong>
            </div>
          ) : (
            <div className="scheduler-subtitle">Pick a profile to see its schedule.</div>
          )}
        </div>
      </div>

      <div className="scheduler-calendar">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
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
          min={new Date(1970, 1, 1, 8, 0, 0)}
          max={new Date(1970, 1, 1, 20, 0, 0)}
        />
      </div>

      <div className="scheduler-legend">
        {ROOM_META.map((room) => (
          <div key={room.id} className="legend-item">
            <span className="legend-swatch" style={{ backgroundColor: room.color }} />
            <span>{room.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
