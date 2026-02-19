import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountSelection from "../../components/AccountSelection";
import axios from "axios";

// ---- mocks ----
jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const mockNavigate = jest.fn();
let mockSearchParamsGet = jest.fn();
const mockSetUser = jest.fn();

// ✅ Stable reference — created once, never recreated on re-render.
// The .get method closes over the *variable* mockSearchParamsGet, so
// reassigning it in beforeEach is still picked up at call-time.
const mockSearchParamsObj = {
  get: (key) => mockSearchParamsGet(key),
};

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParamsObj], // same reference every render → no infinite loop
  };
});

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ setUser: mockSetUser }),
}));

// Mock image + css imports
jest.mock("../../assets/images/FlexygigLogo.png", () => "FlexygigLogo.png");
jest.mock("../../assets/images/ChevronLeft.png", () => "ChevronLeft.png");
jest.mock("../../styles/AccountSelection.css", () => ({}));

describe("AccountSelection - OAuth Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet = jest.fn(() => null);

    // Ensure axios always returns a promise by default
    axios.get.mockResolvedValue({ data: { pending: false } });
    axios.post.mockResolvedValue({ data: {} });

    // localStorage mock
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
  });

  // ---------------------------------------------------------------------------
  describe("OAuth Initialization", () => {
    test("fetches pending OAuth data when oauth=google is in URL", async () => {
      mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          picture: "https://example.com/pic.jpg",
        },
      });

      render(<AccountSelection />);

      expect(axios.get).toHaveBeenCalledWith("/api/auth/google/pending", {
        withCredentials: true,
      });

      expect(await screen.findByText(/Complete Your Registration/i)).toBeInTheDocument();
      expect(await screen.findByText(/Signing up as: test@example.com/i)).toBeInTheDocument();
    });

    test("redirects to signin when no pending OAuth data", async () => {
      mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

      axios.get.mockResolvedValueOnce({
        data: { pending: false },
      });

      render(<AccountSelection />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/signin");
      });
    });

    test("redirects to signin when pending fetch errors", async () => {
      mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));
      axios.get.mockRejectedValueOnce(new Error("network error"));

      render(<AccountSelection />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/signin");
      });
    });

    test("auto-proceeds when accountType is pre-selected from Register", async () => {
      mockSearchParamsGet = jest.fn((key) => {
        if (key === "oauth") return "google";
        if (key === "accountType") return "Worker";
        return null;
      });

      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      axios.post.mockResolvedValueOnce({
        data: {
          success: true,
          user: { id: 1, email: "test@example.com", isbusiness: false },
          workerId: 10,
        },
      });

      render(<AccountSelection />);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          "/api/auth/google/complete",
          expect.objectContaining({
            accountType: "Worker",
          }),
          { withCredentials: true }
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("OAuth Account Selection", () => {
    beforeEach(() => {
      mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));
    });

    test("displays Worker and Employer buttons when OAuth data is loaded", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      render(<AccountSelection />);

      expect(await screen.findByRole("button", { name: /Continue as Worker/i })).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: /Continue as Employer/i })).toBeInTheDocument();
    });

    test("completes registration for Worker account", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "worker@example.com",
          firstName: "John",
          lastName: "Doe",
        },
      });

      axios.post.mockResolvedValueOnce({
        data: {
          success: true,
          user: { id: 1, email: "worker@example.com", isbusiness: false },
          workerId: 10,
        },
      });

      render(<AccountSelection />);

      const workerButton = await screen.findByRole("button", { name: /Continue as Worker/i });
      fireEvent.click(workerButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          "/api/auth/google/complete",
          {
            accountType: "Worker",
            firstName: "John",
            lastName: "Doe",
            businessName: undefined,
          },
          { withCredentials: true }
        );
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "user",
        JSON.stringify({ id: 1, email: "worker@example.com", isbusiness: false, workerId: 10 })
      );
      expect(mockSetUser).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/complete-profile", {
        state: { workerId: 10 },
      });
    });

    test("completes registration for Employer account", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "employer@example.com",
          firstName: "Jane",
          lastName: "Smith",
        },
      });

      axios.post.mockResolvedValueOnce({
        data: {
          success: true,
          user: { id: 2, email: "employer@example.com", isbusiness: true },
        },
      });

      render(<AccountSelection />);

      const employerButton = await screen.findByRole("button", { name: /Continue as Employer/i });
      fireEvent.click(employerButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          "/api/auth/google/complete",
          {
            accountType: "Employer",
            firstName: "Jane",
            lastName: "Smith",
            businessName: "Jane's Business",
          },
          { withCredentials: true }
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });

    test("displays error message when completion fails", async () => {
      axios.get.mockResolvedValue({
        data: {
          pending: true,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      axios.post.mockResolvedValueOnce({
        data: { success: false, message: "Email already exists" },
      });

      render(<AccountSelection />);

      const workerButton = await screen.findByRole("button", { name: /Continue as Worker/i });
      fireEvent.click(workerButton);

      expect(await screen.findByText(/Email already exists/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalledWith("/complete-profile");
      expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
    });

    test("displays error message when completion request throws", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      axios.post.mockRejectedValueOnce({
        response: { data: { message: "Server error" } },
      });

      render(<AccountSelection />);

      const workerButton = await screen.findByRole("button", { name: /Continue as Worker/i });
      fireEvent.click(workerButton);

      expect(await screen.findByText(/Server error/i)).toBeInTheDocument();
    });

    test("displays generic error when completion fails without message", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      axios.post.mockRejectedValueOnce({
        response: {},
      });

      render(<AccountSelection />);

      const workerButton = await screen.findByRole("button", { name: /Continue as Worker/i });
      fireEvent.click(workerButton);

      expect(await screen.findByText(/Registration failed. Please try again./i)).toBeInTheDocument();
    });

    test("back button navigates to signin", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      render(<AccountSelection />);

      await screen.findByText(/Complete Your Registration/i);

      const backButtons = screen.getAllByRole("button");
      const backButton = backButtons.find((btn) =>
        btn.querySelector('img[alt="Back to sign in"]')
      );

      if (backButton) {
        fireEvent.click(backButton);
        expect(mockNavigate).toHaveBeenCalledWith("/signin");
      }
    });

    test("uses default firstName when not provided in OAuth data", async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          pending: true,
          email: "test@example.com",
          firstName: null,
          lastName: null,
        },
      });

      axios.post.mockResolvedValueOnce({
        data: {
          success: true,
          user: { id: 1, email: "test@example.com", isbusiness: false },
          workerId: 10,
        },
      });

      render(<AccountSelection />);

      const workerButton = await screen.findByRole("button", { name: /Continue as Worker/i });
      fireEvent.click(workerButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          "/api/auth/google/complete",
          expect.objectContaining({
            accountType: "Worker",
          }),
          { withCredentials: true }
        );
      });
    });
  });
});