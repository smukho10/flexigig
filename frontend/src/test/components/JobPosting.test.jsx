import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";

// ── Mocks ──────────────────────────────────────────────────────────────────────
jest.mock("axios", () => ({
  get:    jest.fn(),
  patch:  jest.fn(),
  delete: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ user: { id: 42, isbusiness: true } }),
}));

jest.mock("../../components/JobPostingForm", () => () => <div>JobPostingForm</div>);

// Silence console noise from the component
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
  console.warn.mockRestore();
});

import JobPosting from "../../components/JobPosting";

// ── Fixtures ───────────────────────────────────────────────────────────────────
const makeJob = (overrides = {}) => ({
  job_id:          1,
  jobtitle:        "Bartender",
  hourlyrate:      20,
  jobstart:        "2025-07-01T18:00:00Z",
  status:          "open",
  applicant_count: 3,
  locked:          false,
  ...overrides,
});

const inReviewJob = makeJob({ status: "in-review", locked: true });
const openJob     = makeJob({ status: "open" });
const completedJob = makeJob({ job_id: 2, status: "completed" });
const draftJob    = makeJob({ job_id: 3, status: "draft" });

// ── Helpers ────────────────────────────────────────────────────────────────────
const renderComponent = () => render(<JobPosting />);

// Click a status tab by its label
const clickTab = (label) => fireEvent.click(screen.getByRole("button", { name: new RegExp(label, "i") }));

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("JobPosting — Reopen feature", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { jobs: [inReviewJob] } });
    axios.patch.mockResolvedValue({});
  });

  // ── Visibility ───────────────────────────────────────────────────────────────
  describe("Reopen button visibility", () => {
    test("shows Reopen button for an in-review job", async () => {
      renderComponent();
      clickTab("In Review");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument()
      );
    });

    test("does not show Reopen button for an open job", async () => {
      axios.get.mockResolvedValue({ data: { jobs: [openJob] } });
      renderComponent();
      // Default tab is Open
      await waitFor(() => expect(screen.getByText("Bartender")).toBeInTheDocument());

      expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    });

    test("does not show Reopen button for a completed job", async () => {
      axios.get.mockResolvedValue({ data: { jobs: [completedJob] } });
      renderComponent();
      clickTab("Completed");

      await waitFor(() => expect(screen.getByText("Bartender")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    });

    test("does not show Reopen button for a draft job", async () => {
      axios.get.mockResolvedValue({ data: { jobs: [draftJob] } });
      renderComponent();
      clickTab("Drafts");

      await waitFor(() => expect(screen.getByText("Bartender")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    });
  });

  // ── API calls ─────────────────────────────────────────────────────────────────
  describe("clicking Reopen makes the correct API calls", () => {
    test("calls PATCH /api/job-status/:id with status open", async () => {
      renderComponent();
      clickTab("In Review");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

      await waitFor(() =>
        expect(axios.patch).toHaveBeenCalledWith(
          `/api/job-status/${inReviewJob.job_id}`,
          { status: "open" },
          { withCredentials: true }
        )
      );
    });

    test("calls PATCH /api/jobs/:id/lock with locked false", async () => {
      renderComponent();
      clickTab("In Review");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

      await waitFor(() =>
        expect(axios.patch).toHaveBeenCalledWith(
          `/api/jobs/${inReviewJob.job_id}/lock`,
          { locked: false },
          { withCredentials: true }
        )
      );
    });

    test("makes both PATCH calls when Reopen is clicked", async () => {
      renderComponent();
      clickTab("In Review");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

      await waitFor(() => expect(axios.patch).toHaveBeenCalledTimes(2));
    });
  });

  // ── Tab navigation ─────────────────────────────────────────────────────────
  describe("after Reopen, active tab switches to Open", () => {
    test("job card moves out of the In Review tab", async () => {
      renderComponent();
      clickTab("In Review");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

      // The component switches activeTab to Open, so the in-review card should disappear
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument()
      );
    });

    test("Open tab becomes active after Reopen", async () => {
      renderComponent();
      clickTab("In Review");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

      // The Open tab button should now have the active class
      await waitFor(() => {
        const openTab = screen.getByRole("button", { name: /^Open/ });
        expect(openTab).toHaveClass("active");
      });
    });
  });

  // ── Error resilience ──────────────────────────────────────────────────────
  describe("Reopen when API calls fail", () => {
    test("still switches the tab locally even if both PATCH calls fail", async () => {
      axios.patch.mockRejectedValue(new Error("Network error"));

      renderComponent();
      clickTab("In Review");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

      // Local state update happens before the API calls, so tab still switches
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument()
      );
    });
  });
});
