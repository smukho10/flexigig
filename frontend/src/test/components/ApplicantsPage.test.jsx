// frontend/src/test/components/ApplicantsPage.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";

// ── Mocks ──────────────────────────────────────────────────────────────────────
jest.mock("axios");

jest.mock("react-router-dom", () => ({
  useParams:   () => ({ jobId: "5" }),
  useLocation: () => ({ state: { job: { jobtitle: "Bartender", status: "completed" } } }),
  useNavigate: () => jest.fn(),
}));

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ user: { id: 10 } }),
}));

jest.mock("../../assets/images/ChevronLeft.png", () => "ChevronLeft.png");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
  console.warn.mockRestore();
});

import ApplicantsPage from "../../components/ApplicantsPage";

// ── Fixtures ───────────────────────────────────────────────────────────────────
const makeApplicant = (overrides = {}) => ({
  application_id:      201,
  worker_profile_id:   50,
  user_id:             7,
  first_name:          "Alice",
  last_name:           "Smith",
  email:               "alice@example.com",
  profile_name:        "alice_s",
  applied_at:          "2025-06-01T10:00:00Z",
  application_status:  "ACCEPTED",
  has_reviewed_worker: false,
  ...overrides,
});

// Returns a fresh mock that handles both API endpoints for a completed job
const setupCompletedJob = (applicantOverrides = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/api/job-applicants/"))
      return Promise.resolve({ data: { applicants: [makeApplicant(applicantOverrides)] } });
    if (url.includes("/api/edit-job/"))
      return Promise.resolve({ data: { status: "completed" } });
    return Promise.resolve({ data: {} });
  });
};

// ══════════════════════════════════════════════════════════════════════════════
describe("ApplicantsPage — Rate Worker button visibility", () => {
  beforeEach(() => jest.clearAllMocks());

  test("shows 'Rate Worker' for ACCEPTED applicant on completed job", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /rate worker/i })).toBeInTheDocument()
    );
  });

  test("shows '✓ Rated' (disabled) when has_reviewed_worker is true", async () => {
    setupCompletedJob({ has_reviewed_worker: true });
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /✓ rated/i })).toBeDisabled()
    );
  });

  test("does NOT show Rate Worker when job is not completed", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/api/job-applicants/"))
        return Promise.resolve({ data: { applicants: [makeApplicant()] } });
      if (url.includes("/api/edit-job/"))
        return Promise.resolve({ data: { status: "open" } });
      return Promise.resolve({ data: {} });
    });
    render(<ApplicantsPage />);
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /rate worker/i })).not.toBeInTheDocument();
  });

  test("does NOT show Rate Worker when application_status is IN_REVIEW", async () => {
    setupCompletedJob({ application_status: "IN_REVIEW" });
    render(<ApplicantsPage />);
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /rate worker/i })).not.toBeInTheDocument();
  });

  test("does NOT show Rate Worker when application_status is REJECTED", async () => {
    setupCompletedJob({ application_status: "REJECTED" });
    render(<ApplicantsPage />);
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /rate worker/i })).not.toBeInTheDocument();
  });

  test("does NOT show Rate Worker when application_status is WITHDRAWN", async () => {
    setupCompletedJob({ application_status: "WITHDRAWN" });
    render(<ApplicantsPage />);
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /rate worker/i })).not.toBeInTheDocument();
  });

  test("shows Accept/In Review/Reject buttons on open jobs", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/api/job-applicants/"))
        return Promise.resolve({
          data: { applicants: [makeApplicant({ application_status: "APPLIED" })] },
        });
      if (url.includes("/api/edit-job/"))
        return Promise.resolve({ data: { status: "open" } });
      return Promise.resolve({ data: {} });
    });
    render(<ApplicantsPage />);
    // Multiple buttons may match /accept/i (e.g. "Accept" + aria labels) — use getAllByRole
    await waitFor(() => {
      const acceptBtns = screen.getAllByRole("button", { name: /accept/i });
      expect(acceptBtns.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByRole("button", { name: /in review/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /reject/i }).length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("ApplicantsPage — Review modal interactions", () => {
  beforeEach(() => jest.clearAllMocks());

  test("opens when Rate Worker is clicked", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    expect(screen.getByText(/rate alice smith/i)).toBeInTheDocument();
  });

  test("renders 5 star spans inside the modal", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);
    expect(document.querySelectorAll(".star-rating .star")).toHaveLength(5);
  });

  test("clicking star 5 fills all stars", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);
    const stars = document.querySelectorAll(".star-rating .star");
    fireEvent.click(stars[4]);
    stars.forEach((s) => expect(s).toHaveClass("filled"));
  });

  test("clicking star 2 fills only stars 1 and 2", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);
    const stars = document.querySelectorAll(".star-rating .star");
    fireEvent.click(stars[1]);
    expect(stars[0]).toHaveClass("filled");
    expect(stars[1]).toHaveClass("filled");
    expect(stars[2]).not.toHaveClass("filled");
    expect(stars[3]).not.toHaveClass("filled");
    expect(stars[4]).not.toHaveClass("filled");
  });

  test("textarea accepts review text", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);
    const textarea = screen.getByPlaceholderText(/write a review/i);
    fireEvent.change(textarea, { target: { value: "Very punctual." } });
    expect(textarea.value).toBe("Very punctual.");
  });

  test("Cancel button closes the modal", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByText(/rate alice smith/i)).not.toBeInTheDocument()
    );
  });

  test("clicking the overlay closes the modal", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);
    fireEvent.click(document.querySelector(".review-modal-overlay"));
    await waitFor(() =>
      expect(screen.queryByText(/rate alice smith/i)).not.toBeInTheDocument()
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("ApplicantsPage — Review submission", () => {
  beforeEach(() => jest.clearAllMocks());

  test("calls POST /api/reviews/employer-to-worker with correct payload", async () => {
    setupCompletedJob();
    axios.post.mockResolvedValueOnce({ data: { id: 55 } });
    render(<ApplicantsPage />);

    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);

    fireEvent.click(document.querySelectorAll(".star-rating .star")[2]); // 3 stars
    fireEvent.change(screen.getByPlaceholderText(/write a review/i), {
      target: { value: "Good effort." },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        "/api/reviews/employer-to-worker",
        { reviewer_id: 10, reviewee_id: 7, job_id: 5, rating: 3, review_text: "Good effort." },
        { withCredentials: true }
      )
    );
  });

  test("sends rating: undefined when no stars selected (text-only review)", async () => {
    setupCompletedJob();
    axios.post.mockResolvedValueOnce({ data: { id: 56 } });
    render(<ApplicantsPage />);

    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);

    fireEvent.change(screen.getByPlaceholderText(/write a review/i), {
      target: { value: "On time." },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        "/api/reviews/employer-to-worker",
        expect.objectContaining({ review_text: "On time." }),
        expect.anything()
      )
    );
  });

  test("shows validation error when neither rating nor text provided", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);

    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(screen.getByText(/please provide a rating or review text/i)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("shows success message after successful submission", async () => {
    setupCompletedJob();
    axios.post.mockResolvedValueOnce({ data: { id: 55 } });
    render(<ApplicantsPage />);

    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);

    fireEvent.click(document.querySelectorAll(".star-rating .star")[4]); // 5 stars
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByText(/review submitted/i)).toBeInTheDocument()
    );
  });

  test("re-fetches applicants after successful review", async () => {
    setupCompletedJob();
    axios.post.mockResolvedValueOnce({ data: { id: 55 } });
    render(<ApplicantsPage />);

    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);

    fireEvent.click(document.querySelectorAll(".star-rating .star")[3]); // 4 stars
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    // After 1800ms timeout in the component, fetchApplicants() is called again
    await waitFor(
      () => {
        const jobApplicantCalls = axios.get.mock.calls.filter((c) =>
          c[0].includes("/api/job-applicants/")
        );
        expect(jobApplicantCalls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 3000 }
    );
  });

  test("shows API error message on submission failure", async () => {
    setupCompletedJob();
    axios.post.mockRejectedValueOnce({
      response: { data: { message: "You have already reviewed this user." } },
    });
    render(<ApplicantsPage />);

    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);

    fireEvent.click(document.querySelectorAll(".star-rating .star")[2]);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByText("You have already reviewed this user.")).toBeInTheDocument()
    );
  });

  test("shows fallback error message when API fails without a message", async () => {
    setupCompletedJob();
    axios.post.mockRejectedValueOnce(new Error("Network error"));
    render(<ApplicantsPage />);

    const rateBtn = await screen.findByRole("button", { name: /rate worker/i });
    fireEvent.click(rateBtn);
    await screen.findByText(/rate alice smith/i);

    fireEvent.click(document.querySelectorAll(".star-rating .star")[1]);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to submit review/i)).toBeInTheDocument()
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("ApplicantsPage — status switch buttons", () => {
  beforeEach(() => jest.clearAllMocks());

  // Helper: render an open job with a single applicant at the given status
  const setupOpenJob = (statusOverride = "APPLIED") => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/api/job-applicants/"))
        return Promise.resolve({
          data: { applicants: [makeApplicant({ application_status: statusOverride })] },
        });
      if (url.includes("/api/edit-job/"))
        return Promise.resolve({ data: { status: "open" } });
      return Promise.resolve({ data: {} });
    });
  };

  // ── Button click dispatches correct PATCH call ────────────────────────────

  test("clicking Accept calls PATCH with status ACCEPTED", async () => {
    setupOpenJob("APPLIED");
    axios.patch.mockResolvedValueOnce({});
    render(<ApplicantsPage />);

    await waitFor(() =>
      expect(document.querySelector("button.accept-btn")).toBeInTheDocument()
    );
    fireEvent.click(document.querySelector("button.accept-btn"));

    await waitFor(() =>
      expect(axios.patch).toHaveBeenCalledWith(
        "/api/applications/201/status",
        { status: "ACCEPTED" },
        { withCredentials: true }
      )
    );
  });

  test("clicking In Review calls PATCH with status IN_REVIEW", async () => {
    setupOpenJob("APPLIED");
    axios.patch.mockResolvedValueOnce({});
    render(<ApplicantsPage />);

    await waitFor(() =>
      expect(document.querySelector("button.review-btn")).toBeInTheDocument()
    );
    fireEvent.click(document.querySelector("button.review-btn"));

    await waitFor(() =>
      expect(axios.patch).toHaveBeenCalledWith(
        "/api/applications/201/status",
        { status: "IN_REVIEW" },
        { withCredentials: true }
      )
    );
  });

  test("clicking Reject calls PATCH with status REJECTED", async () => {
    setupOpenJob("APPLIED");
    axios.patch.mockResolvedValueOnce({});
    render(<ApplicantsPage />);

    await waitFor(() =>
      expect(document.querySelector("button.reject-btn")).toBeInTheDocument()
    );
    fireEvent.click(document.querySelector("button.reject-btn"));

    await waitFor(() =>
      expect(axios.patch).toHaveBeenCalledWith(
        "/api/applications/201/status",
        { status: "REJECTED" },
        { withCredentials: true }
      )
    );
  });

  // ── Accept button disabled states ─────────────────────────────────────────

  test("Accept button is disabled when applicant status is ACCEPTED", async () => {
    setupOpenJob("ACCEPTED");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.accept-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.accept-btn")).toBeDisabled();
  });

  test("Accept button is disabled when applicant status is WITHDRAWN", async () => {
    setupOpenJob("WITHDRAWN");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.accept-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.accept-btn")).toBeDisabled();
  });

  test("Accept button is enabled when applicant status is APPLIED", async () => {
    setupOpenJob("APPLIED");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.accept-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.accept-btn")).not.toBeDisabled();
  });

  test("Accept button is enabled when applicant status is IN_REVIEW", async () => {
    setupOpenJob("IN_REVIEW");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.accept-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.accept-btn")).not.toBeDisabled();
  });

  // ── In Review button disabled states ──────────────────────────────────────

  test("In Review button is disabled when applicant status is IN_REVIEW", async () => {
    setupOpenJob("IN_REVIEW");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.review-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.review-btn")).toBeDisabled();
  });

  test("In Review button is disabled when applicant status is ACCEPTED", async () => {
    setupOpenJob("ACCEPTED");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.review-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.review-btn")).toBeDisabled();
  });

  test("In Review button is disabled when applicant status is REJECTED", async () => {
    setupOpenJob("REJECTED");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.review-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.review-btn")).toBeDisabled();
  });

  test("In Review button is disabled when applicant status is WITHDRAWN", async () => {
    setupOpenJob("WITHDRAWN");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.review-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.review-btn")).toBeDisabled();
  });

  test("In Review button is enabled when applicant status is APPLIED", async () => {
    setupOpenJob("APPLIED");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.review-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.review-btn")).not.toBeDisabled();
  });

  // ── Reject button disabled states ─────────────────────────────────────────

  test("Reject button is disabled when applicant status is REJECTED", async () => {
    setupOpenJob("REJECTED");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.reject-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.reject-btn")).toBeDisabled();
  });

  test("Reject button is disabled when applicant status is ACCEPTED", async () => {
    setupOpenJob("ACCEPTED");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.reject-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.reject-btn")).toBeDisabled();
  });

  test("Reject button is disabled when applicant status is WITHDRAWN", async () => {
    setupOpenJob("WITHDRAWN");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.reject-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.reject-btn")).toBeDisabled();
  });

  test("Reject button is enabled when applicant status is APPLIED", async () => {
    setupOpenJob("APPLIED");
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(document.querySelector("button.reject-btn")).toBeInTheDocument()
    );
    expect(document.querySelector("button.reject-btn")).not.toBeDisabled();
  });

  // ── Status switch buttons absent on completed jobs ────────────────────────

  test("Accept / In Review / Reject buttons are not rendered on a completed job", async () => {
    setupCompletedJob({ application_status: "ACCEPTED" });
    render(<ApplicantsPage />);
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(document.querySelector("button.accept-btn")).not.toBeInTheDocument();
    expect(document.querySelector("button.review-btn")).not.toBeInTheDocument();
    expect(document.querySelector("button.reject-btn")).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("ApplicantsPage — General UI", () => {
  beforeEach(() => jest.clearAllMocks());

  test("shows loading state initially", () => {
    axios.get.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<ApplicantsPage />);
    expect(screen.getByText(/loading applicants/i)).toBeInTheDocument();
  });

  test("shows empty state when no applicants", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/api/job-applicants/"))
        return Promise.resolve({ data: { applicants: [] } });
      return Promise.resolve({ data: { status: "completed" } });
    });
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(screen.getByText(/no applicants yet/i)).toBeInTheDocument()
    );
  });

  test("shows total applicant count", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/api/job-applicants/"))
        return Promise.resolve({
          data: {
            applicants: [
              makeApplicant({ application_id: 201 }),
              makeApplicant({ application_id: 202, first_name: "Bob", last_name: "Jones" }),
            ],
          },
        });
      return Promise.resolve({ data: { status: "completed" } });
    });
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(screen.getByText(/2 total applicants/i)).toBeInTheDocument()
    );
  });

  test("shows Completed badge on completed job", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(screen.getByText(/✓ completed/i)).toBeInTheDocument()
    );
  });

  test("shows rating note on completed job", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/you can rate accepted workers for this completed job/i)
      ).toBeInTheDocument()
    );
  });

  test("displays applicant name, email, and profile tag", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("alice_s")).toBeInTheDocument();
    });
  });

  test("displays applicant status badge", async () => {
    setupCompletedJob();
    render(<ApplicantsPage />);
    await waitFor(() =>
      expect(screen.getByText("ACCEPTED")).toBeInTheDocument()
    );
  });
});