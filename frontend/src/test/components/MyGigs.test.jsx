// frontend/src/test/components/MyGigs.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";

// ── Mocks ──────────────────────────────────────────────────────────────────────
jest.mock("axios");
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ user: { id: 7 } }),
}));
jest.mock("../../assets/images/CalendarIcon.png",   () => "CalendarIcon.png");
jest.mock("../../assets/images/DollarSign.png",     () => "DollarSign.png");
jest.mock("../../assets/images/DefaultAvatar.png",  () => "DefaultAvatar.png");
jest.mock("../../assets/images/MessageBubbles.png", () => "MessageBubbles.png");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
  console.warn.mockRestore();
});

import MyGigs from "../../components/MyGigs";

// ── Fixture ────────────────────────────────────────────────────────────────────
const makeGig = (overrides = {}) => ({
  job_id: 1,
  application_id: 101,
  jobtitle: "Bartender",
  hourlyrate: "20.00",
  jobstart: "2025-07-01T18:00:00Z",
  jobdescription: "Pour drinks.",
  streetaddress: "123 Main St",
  city: "Toronto",
  province: "ON",
  postalcode: "M5V 1A1",
  status: "completed",
  application_status: "ACCEPTED",
  has_reviewed_employer: false,
  employer_user_id: 10,
  business_name: "Cool Bar Inc.",
  ...overrides,
});

// ══════════════════════════════════════════════════════════════════════════════
describe("MyGigs — Rate Employer button visibility", () => {
  beforeEach(() => jest.clearAllMocks());

  test("shows 'Rate Employer' for ACCEPTED + completed gig not yet rated", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /rate employer/i })).toBeInTheDocument()
    );
  });

  test("shows '✓ Rated' (disabled) when has_reviewed_employer is true", async () => {
    axios.get.mockResolvedValueOnce({
      data: { jobs: [makeGig({ has_reviewed_employer: true })] },
    });
    render(<MyGigs />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /✓ rated/i })).toBeDisabled()
    );
  });

  test("does NOT show Rate Employer when job is not completed", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig({ status: "open" })] } });
    render(<MyGigs />);
    await waitFor(() => expect(screen.getByText("Bartender")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /rate employer/i })).not.toBeInTheDocument();
  });

  test("does NOT show Rate Employer when application_status is not ACCEPTED", async () => {
    axios.get.mockResolvedValueOnce({
      data: { jobs: [makeGig({ application_status: "IN_REVIEW" })] },
    });
    render(<MyGigs />);
    await waitFor(() => expect(screen.getByText("Bartender")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /rate employer/i })).not.toBeInTheDocument();
  });

  test("does NOT show Rate Employer for WITHDRAWN application", async () => {
    axios.get.mockResolvedValueOnce({
      data: { jobs: [makeGig({ application_status: "WITHDRAWN" })] },
    });
    render(<MyGigs />);
    await waitFor(() => expect(screen.getByText("Bartender")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /rate employer/i })).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("MyGigs — Review modal interactions", () => {
  beforeEach(() => jest.clearAllMocks());

  test("opens when Rate Employer is clicked", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    expect(screen.getByText(/rate your employer/i)).toBeInTheDocument();
  });

  test("shows employer business name in modal", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    const employerNameEl = document.querySelector(".employer-name");
    expect(employerNameEl).not.toBeNull();
    expect(employerNameEl.textContent).toBe("Cool Bar Inc.");
  });

  test("renders 5 star spans", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    expect(document.querySelectorAll(".star-rating .star")).toHaveLength(5);
  });

  test("clicking star 3 fills stars 1-3 and leaves 4-5 unfilled", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    const stars = document.querySelectorAll(".star-rating .star");
    fireEvent.click(stars[2]);
    expect(stars[0]).toHaveClass("filled");
    expect(stars[1]).toHaveClass("filled");
    expect(stars[2]).toHaveClass("filled");
    expect(stars[3]).not.toHaveClass("filled");
    expect(stars[4]).not.toHaveClass("filled");
  });

  test("textarea accepts comment input", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    const textarea = screen.getByPlaceholderText(/share your experience/i);
    fireEvent.change(textarea, { target: { value: "Wonderful!" } });
    expect(textarea.value).toBe("Wonderful!");
  });

  test("Cancel button closes the modal", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByText(/rate your employer/i)).not.toBeInTheDocument()
    );
  });

  test("close button (symbol) closes the modal", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    // Find the close button — it's the short-text button that isn't Cancel or Submit
    const allBtns = screen.getAllByRole("button");
    const closeBtn = allBtns.find(
      (b) => b.textContent.trim().length <= 3 && !/cancel|submit/i.test(b.textContent)
    );
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn);
    await waitFor(() =>
      expect(screen.queryByText(/rate your employer/i)).not.toBeInTheDocument()
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("MyGigs — Review submission", () => {
  beforeEach(() => jest.clearAllMocks());

  test("calls POST /api/reviews/worker-to-employer with correct payload", async () => {
    axios.get.mockResolvedValue({ data: { jobs: [makeGig()] } });
    axios.post.mockResolvedValueOnce({ data: { id: 99 } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    fireEvent.click(document.querySelectorAll(".star-rating .star")[3]);
    fireEvent.change(screen.getByPlaceholderText(/share your experience/i), {
      target: { value: "Really good!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        "/api/reviews/worker-to-employer",
        { reviewer_id: 7, reviewee_id: 10, rating: 4, review_text: "Really good!", job_id: 1 },
        { withCredentials: true }
      )
    );
  });

  test("sends null rating when no star selected (text-only review)", async () => {
    axios.get.mockResolvedValue({ data: { jobs: [makeGig()] } });
    axios.post.mockResolvedValueOnce({ data: { id: 100 } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    fireEvent.change(screen.getByPlaceholderText(/share your experience/i), {
      target: { value: "Good enough." },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        "/api/reviews/worker-to-employer",
        expect.objectContaining({ rating: null, review_text: "Good enough." }),
        expect.anything()
      )
    );
  });

  test("does NOT call API and closes modal when both rating and comment are empty", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(axios.post).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText(/rate your employer/i)).not.toBeInTheDocument()
    );
  });

  test("shows success state after successful submit", async () => {
    axios.get.mockResolvedValue({ data: { jobs: [makeGig()] } });
    axios.post.mockResolvedValueOnce({ data: { id: 99 } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    fireEvent.click(document.querySelectorAll(".star-rating .star")[4]);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect(screen.getByText(/thanks for rating/i)).toBeInTheDocument()
    );
  });

  test("re-fetches gigs after submit so button flips to Rated", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { jobs: [makeGig()] } })
      .mockResolvedValueOnce({ data: { jobs: [makeGig({ has_reviewed_employer: true })] } });
    axios.post.mockResolvedValueOnce({ data: { id: 99 } });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    fireEvent.click(document.querySelectorAll(".star-rating .star")[2]);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2), { timeout: 4000 });
  });

  test("shows alert on API error", async () => {
    const alertMock = jest.spyOn(window, "alert").mockImplementation(() => {});
    axios.get.mockResolvedValueOnce({ data: { jobs: [makeGig()] } });
    axios.post.mockRejectedValueOnce({
      response: { data: { message: "Already reviewed" } },
    });
    render(<MyGigs />);
    await waitFor(() =>
      fireEvent.click(screen.getByRole("button", { name: /rate employer/i }))
    );
    fireEvent.click(document.querySelectorAll(".star-rating .star")[0]);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith("Already reviewed"));
    alertMock.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("MyGigs — Empty state", () => {
  beforeEach(() => jest.clearAllMocks());

  test("shows empty state when user has no gigs", async () => {
    axios.get.mockResolvedValueOnce({ data: { jobs: [] } });
    render(<MyGigs />);
    await waitFor(() =>
      expect(screen.getByText(/you have no gigs at the moment/i)).toBeInTheDocument()
    );
  });

  test("filters out APPLIED status gigs from display", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        jobs: [
          makeGig({ application_status: "APPLIED", job_id: 1, jobtitle: "Bartender" }),
          makeGig({ application_status: "ACCEPTED", job_id: 2, jobtitle: "Cook" }),
        ],
      },
    });
    render(<MyGigs />);
    await waitFor(() => expect(screen.getByText("Cook")).toBeInTheDocument());
    expect(screen.queryByText("Bartender")).not.toBeInTheDocument();
  });
});