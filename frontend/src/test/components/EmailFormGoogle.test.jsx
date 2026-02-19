import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import EmailForm from "../../components/EmailForm";
import axios from "axios";

// ---- mocks ----
jest.mock("axios");

const mockNavigate = jest.fn();
const mockSetIsDone = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock image + css imports
jest.mock("../../assets/images/FlexygigLogo.png", () => "FlexygigLogo.png");
jest.mock("../../styles/EmailForm.css", () => ({}));

// Mock window.location
const mockLocation = {
  href: "",
};
delete window.location;
window.location = mockLocation;

describe("EmailForm Component - Google Signup", () => {
  const mockSetData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = "";
    process.env.REACT_APP_BACKEND_URL = "http://localhost:5000";
  });

  test("renders Google signup button", () => {
    const data = { accountType: "Worker", email: "", password: "" };
    render(<EmailForm data={data} setData={mockSetData} setIsDone={mockSetIsDone} />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    expect(googleButton).toBeInTheDocument();
  });

  test("redirects to Google OAuth with Worker accountType when clicked", () => {
    const data = { accountType: "Worker", email: "", password: "" };
    render(<EmailForm data={data} setData={mockSetData} setIsDone={mockSetIsDone} />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    fireEvent.click(googleButton);

    expect(window.location.href).toBe("http://localhost:5000/api/auth/google?accountType=Worker");
  });

  test("redirects to Google OAuth with Employer accountType when clicked", () => {
    const data = { accountType: "Employer", email: "", password: "" };
    render(<EmailForm data={data} setData={mockSetData} setIsDone={mockSetIsDone} />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    fireEvent.click(googleButton);

    expect(window.location.href).toBe("http://localhost:5000/api/auth/google?accountType=Employer");
  });

  test("redirects to Google OAuth without accountType when not provided", () => {
    const data = { email: "", password: "" };
    render(<EmailForm data={data} setData={mockSetData} setIsDone={mockSetIsDone} />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    fireEvent.click(googleButton);

    expect(window.location.href).toBe("http://localhost:5000/api/auth/google");
  });

  test("Google button has correct styling class", () => {
    const data = { accountType: "Worker", email: "", password: "" };
    render(<EmailForm data={data} setData={mockSetData} setIsDone={mockSetIsDone} />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    expect(googleButton).toHaveClass("google-signin-btn");
  });

  test("Google button contains SVG icon", () => {
    const data = { accountType: "Worker", email: "", password: "" };
    render(<EmailForm data={data} setData={mockSetData} setIsDone={mockSetIsDone} />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    const svg = googleButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  test("URL encodes accountType correctly", () => {
    const data = { accountType: "Worker", email: "", password: "" };
    render(<EmailForm data={data} setData={mockSetData} setIsDone={mockSetIsDone} />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google/i });
    fireEvent.click(googleButton);

    // Verify the URL contains properly encoded accountType
    expect(window.location.href).toContain("accountType=Worker");
  });
});
