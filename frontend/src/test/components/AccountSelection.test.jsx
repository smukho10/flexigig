import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountSelection from "../../components/AccountSelection";
import axios from "axios";

// ---- mocks ----
jest.mock("axios");

const mockNavigate = jest.fn();
let mockSearchParamsGet = jest.fn();

const mockSetUser = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [
      {
        get: (key) => mockSearchParamsGet(key),
      },
    ],
  };
});

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ setUser: mockSetUser }),
}));

// Mock image + css imports used by component
jest.mock("../../assets/images/FlexygigLogo.png", () => "FlexygigLogo.png");
jest.mock("../../assets/images/ChevronLeft.png", () => "ChevronLeft.png");
jest.mock("../../styles/AccountSelection.css", () => ({}));

describe("AccountSelection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet = jest.fn(() => null);

    // localStorage mock
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
  });

//   test("renders non-OAuth account selection UI and navigates to register with correct params/state", () => {
//     render(<AccountSelection />);

//     expect(screen.getByText(/Select Account Type/i)).toBeInTheDocument();

//     const workerBtn = screen.getByRole("button", { name: /Create Worker Account/i });
//     const employerBtn = screen.getByRole("button", { name: /Create Employer Account/i });

//     fireEvent.click(workerBtn);
//     expect(mockNavigate).toHaveBeenCalledWith("/register?accountType=Worker", {
//       state: { fromAccountSelection: true },
//     });

//     fireEvent.click(employerBtn);
//     expect(mockNavigate).toHaveBeenCalledWith("/register?accountType=Employer", {
//       state: { fromAccountSelection: true },
//     });
//   });

//   test("non-OAuth back button navigates to /signin", () => {
//     render(<AccountSelection />);

//     const backBtn = screen.getByRole("button");
//     fireEvent.click(backBtn);

//     expect(mockNavigate).toHaveBeenCalledWith("/signin");
//   });

//   test("OAuth mode: fetches pending OAuth data and shows email + continue buttons", async () => {
//     mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

//     axios.get.mockResolvedValueOnce({
//       data: {
//         pending: true,
//         email: "test@example.com",
//         firstName: "Test",
//         lastName: "User",
//       },
//     });

//     render(<AccountSelection />);

//     // Wait for pending data to be displayed
//     expect(await screen.findByText(/Complete Your Registration/i)).toBeInTheDocument();
//     expect(await screen.findByText(/Signing up as: test@example.com/i)).toBeInTheDocument();

//     expect(screen.getByRole("button", { name: /Continue as Worker/i })).toBeInTheDocument();
//     expect(screen.getByRole("button", { name: /Continue as Employer/i })).toBeInTheDocument();

//     // verify axios called correctly
//     expect(axios.get).toHaveBeenCalledWith("/api/auth/google/pending", { withCredentials: true });
//   });

//   test("OAuth mode: if no pending OAuth data, redirects to /signin", async () => {
//     mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

//     axios.get.mockResolvedValueOnce({
//       data: { pending: false },
//     });

//     render(<AccountSelection />);

//     await waitFor(() => {
//       expect(mockNavigate).toHaveBeenCalledWith("/signin");
//     });
//   });

//   test("OAuth mode: if pending fetch errors, redirects to /signin", async () => {
//     mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));
//     axios.get.mockRejectedValueOnce(new Error("network"));

//     render(<AccountSelection />);

//     await waitFor(() => {
//       expect(mockNavigate).toHaveBeenCalledWith("/signin");
//     });
//   });

//   test("OAuth completion success: stores user, calls setUser, navigates to /dashboard (Worker)", async () => {
//     mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

//     // pending data
//     axios.get.mockResolvedValueOnce({
//       data: {
//         pending: true,
//         email: "test@example.com",
//         firstName: "Test",
//         lastName: "User",
//       },
//     });

//     // completion success
//     axios.post.mockResolvedValueOnce({
//       data: {
//         success: true,
//         user: { id: 1, email: "test@example.com", role: "Worker" },
//       },
//     });

//     render(<AccountSelection />);

//     const workerContinue = await screen.findByRole("button", { name: /Continue as Worker/i });
//     fireEvent.click(workerContinue);

//     await waitFor(() => {
//       expect(axios.post).toHaveBeenCalledWith(
//         "/api/auth/google/complete",
//         {
//           accountType: "Worker",
//           firstName: "Test",
//           lastName: "User",
//           businessName: undefined,
//         },
//         { withCredentials: true }
//       );
//     });

//     expect(localStorage.setItem).toHaveBeenCalledWith(
//       "user",
//       JSON.stringify({ id: 1, email: "test@example.com", role: "Worker" })
//     );
//     expect(mockSetUser).toHaveBeenCalledWith({ id: 1, email: "test@example.com", role: "Worker" });
//     expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
//   });

//   test("OAuth completion success: Employer sets businessName in payload", async () => {
//     mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

//     axios.get.mockResolvedValueOnce({
//       data: {
//         pending: true,
//         email: "boss@example.com",
//         firstName: "Boss",
//         lastName: "Person",
//       },
//     });

//     axios.post.mockResolvedValueOnce({
//       data: {
//         success: true,
//         user: { id: 2, email: "boss@example.com", role: "Employer" },
//       },
//     });

//     render(<AccountSelection />);

//     const employerContinue = await screen.findByRole("button", { name: /Continue as Employer/i });
//     fireEvent.click(employerContinue);

//     await waitFor(() => {
//       expect(axios.post).toHaveBeenCalledWith(
//         "/api/auth/google/complete",
//         {
//           accountType: "Employer",
//           firstName: "Boss",
//           lastName: "Person",
//           businessName: "Boss's Business",
//         },
//         { withCredentials: true }
//       );
//     });
//   });

//   test("OAuth completion failure: shows API message when success=false", async () => {
//     mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

//     axios.get.mockResolvedValueOnce({
//       data: {
//         pending: true,
//         email: "test@example.com",
//         firstName: "Test",
//         lastName: "User",
//       },
//     });

//     axios.post.mockResolvedValueOnce({
//       data: { success: false, message: "Email already exists" },
//     });

//     render(<AccountSelection />);

//     const workerContinue = await screen.findByRole("button", { name: /Continue as Worker/i });
//     fireEvent.click(workerContinue);

//     expect(await screen.findByText(/Email already exists/i)).toBeInTheDocument();
//     expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
//   });

//   test("OAuth completion error: shows server error message if request throws", async () => {
//     mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

//     axios.get.mockResolvedValueOnce({
//       data: {
//         pending: true,
//         email: "test@example.com",
//         firstName: "Test",
//         lastName: "User",
//       },
//     });

//     axios.post.mockRejectedValueOnce({
//       response: { data: { message: "Server exploded" } },
//     });

//     render(<AccountSelection />);

//     const workerContinue = await screen.findByRole("button", { name: /Continue as Worker/i });
//     fireEvent.click(workerContinue);

//     expect(await screen.findByText(/Server exploded/i)).toBeInTheDocument();
//   });

  test("OAuth back button navigates to /signin", async () => {
    mockSearchParamsGet = jest.fn((key) => (key === "oauth" ? "google" : null));

    axios.get.mockResolvedValueOnce({
      data: {
        pending: true,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      },
    });

    render(<AccountSelection />);

    // wait for OAuth mode render
    await screen.findByText(/Complete Your Registration/i);

    const backBtn = screen.getByRole("button");
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/signin");
  });
});
