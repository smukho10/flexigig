import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignIn from "../../components/SignIn";
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
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  };
});

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ setUser: mockSetUser }),
}));

// Mock image + css imports
jest.mock("../../assets/images/FlexygigLogo.png", () => "FlexygigLogo.png");
jest.mock("../../assets/images/ChevronLeft.png", () => "ChevronLeft.png");
jest.mock("../../styles/SignIn.css", () => ({}));

// Mock window.location
const mockLocation = {
  href: "",
};
delete window.location;
window.location = mockLocation;

describe("SignIn Component - Google Login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet = jest.fn(() => null);
    mockLocation.href = "";
    
    // localStorage mock
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
  });

  test("renders Google login button", () => {
    render(<SignIn />);
    
    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    expect(googleButton).toBeInTheDocument();
  });

  test("redirects to backend Google OAuth endpoint when Google button is clicked", () => {
    process.env.REACT_APP_BACKEND_URL = "http://localhost:5000";
    
    render(<SignIn />);
    
    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    fireEvent.click(googleButton);
    
    expect(window.location.href).toBe("http://localhost:5000/api/auth/google");
  });

  test("displays error message when oauth_failed error is in URL params", () => {
    mockSearchParamsGet = jest.fn((key) => (key === "error" ? "oauth_failed" : null));
    
    render(<SignIn />);
    
    expect(screen.getByText(/Google sign-in failed. Please try again./i)).toBeInTheDocument();
  });

  test("displays error message when session_error is in URL params", () => {
    mockSearchParamsGet = jest.fn((key) => (key === "error" ? "session_error" : null));
    
    render(<SignIn />);
    
    expect(screen.getByText(/Session error. Please try again./i)).toBeInTheDocument();
  });

  test("does not display error message when no error in URL params", () => {
    mockSearchParamsGet = jest.fn(() => null);
    
    render(<SignIn />);
    
    expect(screen.queryByText(/Google sign-in failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Session error/i)).not.toBeInTheDocument();
  });

  test("Google button has correct styling class", () => {
    render(<SignIn />);
    
    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    expect(googleButton).toHaveClass("google-signin-btn");
  });

  test("Google button contains SVG icon", () => {
    render(<SignIn />);
    
    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    const svg = googleButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });
});
