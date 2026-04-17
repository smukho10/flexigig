import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import axios from "axios";
import ProfileScheduler from "../../components/ProfileScheduler";

// ── Mocks ──────────────────────────────────────────────────────────────────────
jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ user: { id: 42 } }),
}));

jest.mock("react-big-calendar", () => {
  const React = require("react");
  return {
    Calendar: (props) => (
      <div data-testid="big-calendar-mock">
        {props.events && props.events.map((evt, idx) => (
          <button 
            key={idx} 
            data-testid={`event-${evt.id}`} 
            onClick={() => props.onSelectEvent && props.onSelectEvent(evt)}
          >
            {evt.title}
          </button>
        ))}
      </div>
    ),
    dateFnsLocalizer: () => ({}),
    Views: { WEEK: 'week', DAY: 'day', AGENDA: 'agenda' }
  };
});

// We only need basic DOM manipulation for checking modal logic, 
// so we don't necessarily need to fully mock react-big-calendar if not required.

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
  console.warn.mockRestore();
});

// ── Fixtures ───────────────────────────────────────────────────────────────────
const mockEvents = [
  {
    id: 1,
    title: "Morning Shift",
    startdate: "2026-04-20",
    enddate: "2026-04-20",
    starttime: "09:00",
    endtime: "13:00",
  },
  {
    id: 2,
    title: "Afternoon Shift",
    startdate: "2026-04-20",
    enddate: "2026-04-20",
    starttime: "14:00",
    endtime: "18:00",
  }
];

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("ProfileScheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: mockEvents });
    axios.post.mockResolvedValue({ data: {} });
  });

  test("renders scheduler and fetches events on mount", async () => {
    render(<ProfileScheduler />);

    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText(/Loading schedule/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/my-calendar/42", expect.any(Object));
    });

    // The calendar should render the shift titles (Big Calendar renders event titles in the UI)
    await waitFor(() => {
      expect(screen.getByText("Morning Shift")).toBeInTheDocument();
      expect(screen.getByText("Afternoon Shift")).toBeInTheDocument();
    });
  });

  test("displays overlap error if a new shift overlaps with existing ones", async () => {
    // We cannot easily simulate a real BigCalendar drag-and-drop slot selection in JSDOM easily.
    // Instead we can click an event to trigger "Edit" mode and edit its times to cause an overlap, 
    // or trigger BigCalendar's onSelectSlot manually if needed. 
    // Another approach is clicking an event to edit.
    
    render(<ProfileScheduler />);
    await waitFor(() => {
      expect(screen.getByText("Morning Shift")).toBeInTheDocument();
    });

    // Click the morning shift to open the edit modal
    fireEvent.click(screen.getByText("Morning Shift"));

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText("Edit Shift")).toBeInTheDocument();
    });

    // Change start/end time to overlap with Afternoon Shift (14:00 to 18:00)
    // Morning Shift currently shows start=09:00, end=13:00
    const startInput = screen.getByDisplayValue("2026-04-20T09:00");
    const endInput = screen.getByDisplayValue("2026-04-20T13:00");

    // "2026-04-20T14:30" - this overlaps with 14:00-18:00
    fireEvent.change(startInput, { target: { value: "2026-04-20T14:30" } });
    fireEvent.change(endInput, { target: { value: "2026-04-20T15:30" } });

    // Click save
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    // Should display overlap error
    await waitFor(() => {
      expect(screen.getByText("This shift overlaps with an existing shift. Please choose a different time.")).toBeInTheDocument();
    });

    // axios.post should not have been called because of the error
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("allows saving if there is no overlap", async () => {
    render(<ProfileScheduler />);
    await waitFor(() => {
      expect(screen.getByText("Morning Shift")).toBeInTheDocument();
    });

    // Open edit modal for Morning Shift
    fireEvent.click(screen.getByText("Morning Shift"));

    await waitFor(() => {
      expect(screen.getByText("Edit Shift")).toBeInTheDocument();
    });

    const startInput = screen.getByDisplayValue("2026-04-20T09:00");
    const endInput = screen.getByDisplayValue("2026-04-20T13:00");

    // Change to a non-overlapping time, e.g., 07:00 to 08:30
    fireEvent.change(startInput, { target: { value: "2026-04-20T07:00" } });
    fireEvent.change(endInput, { target: { value: "2026-04-20T08:30" } });

    // In Edit mode, saving involves DELETE then POST.
    axios.delete.mockResolvedValue({});

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    // Wait for delete and post calls
    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith("/api/my-calendar/1", expect.any(Object));
      expect(axios.post).toHaveBeenCalled();
    });

    // Expect overlap error not to be present
    expect(screen.queryByText("This shift overlaps with an existing shift. Please choose a different time.")).not.toBeInTheDocument();
  });

  test("shows error when start time is after end time", async () => {
    render(<ProfileScheduler />);
    await waitFor(() => {
      expect(screen.getByText("Morning Shift")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Morning Shift"));
    await waitFor(() => {
      expect(screen.getByText("Edit Shift")).toBeInTheDocument();
    });

    const startInput = screen.getByDisplayValue("2026-04-20T09:00");
    const endInput = screen.getByDisplayValue("2026-04-20T13:00");

    // Invalid time range
    fireEvent.change(startInput, { target: { value: "2026-04-20T10:00" } });
    fireEvent.change(endInput, { target: { value: "2026-04-20T09:00" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("End time must be after start time.")).toBeInTheDocument();
    });
  });
});
