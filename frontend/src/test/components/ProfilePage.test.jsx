/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Suppress React "not wrapped in act()" warnings from async effects ────────
const originalError = console.error.bind(console);
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("axios", () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
  put: jest.fn().mockResolvedValue({ data: {} }),
}));

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({
    user: {
      id: 1,
      isbusiness: false,
      firstname: "Test",
      lastname: "User",
      email: "test@test.com",
      biography: "Hello world",
      phone_number: "123-456-7890",
    },
    setUser: jest.fn(),
    logout: jest.fn(),
  }),
  UserProvider: ({ children }) => children,
}));

jest.mock("../../components/ProfileScheduler", () => () => (
  <div data-testid="profile-scheduler">Scheduler</div>
));

jest.mock("../../components/Modal", () => ({
  isOpen,
  title,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}) =>
  isOpen ? (
    <div role="dialog">
      <span>{title}</span>
      {onConfirm && (
        <button onClick={() => onConfirm()}>{confirmText || "OK"}</button>
      )}
      {onCancel && <button onClick={onCancel}>{cancelText || "Cancel"}</button>}
    </div>
  ) : null
);

import ProfilePage from "../../components/ProfilePage";

// ─────────────────────────────────────────────────────────────────────────────

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
  });
};

describe("ProfilePage — worker view", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renders Biography section", async () => {
    await renderPage();
    expect(screen.getByText(/Biography/i)).toBeInTheDocument();
  });

  test("renders About Me section", async () => {
    await renderPage();
    expect(screen.getByText(/About Me/i)).toBeInTheDocument();
  });

  test("renders Work Preferences section", async () => {
    await renderPage();
    expect(screen.getByText(/Work Preferences/i)).toBeInTheDocument();
  });

  test("renders Skills section", async () => {
    await renderPage();
    expect(screen.getByText(/Skills/i)).toBeInTheDocument();
  });

  test("renders Experience section", async () => {
    await renderPage();
    expect(screen.getByText(/Experience/i)).toBeInTheDocument();
  });

  test("renders Resume section", async () => {
    await renderPage();
    expect(screen.getByText(/Resume/i)).toBeInTheDocument();
  });

  test("renders Edit Profile button", async () => {
    await renderPage();
    expect(screen.getByText(/Edit Profile/i)).toBeInTheDocument();
  });

  test("renders Add Profile button", async () => {
    await renderPage();
    expect(screen.getByText(/\+ Add Profile/i)).toBeInTheDocument();
  });

  test("shows empty state when no skills", async () => {
    await renderPage();
    expect(screen.getByText(/No skills added yet/i)).toBeInTheDocument();
  });

  test("shows empty state when no experience", async () => {
    await renderPage();
    expect(screen.getByText(/No experience added yet/i)).toBeInTheDocument();
  });

  test("shows empty state when no resume", async () => {
    await renderPage();
    expect(screen.getByText(/No resume uploaded yet/i)).toBeInTheDocument();
  });

  test("renders ProfileScheduler", async () => {
    await renderPage();
    expect(screen.getByTestId("profile-scheduler")).toBeInTheDocument();
  });

  test("clicking Edit Profile switches to edit form", async () => {
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByText(/Edit Profile/i));
    });
    expect(screen.getByText(/Save Changes/i)).toBeInTheDocument();
  });

  test("Cancel in edit form returns to profile view", async () => {
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByText(/Edit Profile/i));
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Cancel/i));
    });
    expect(screen.getByText(/Biography/i)).toBeInTheDocument();
  });

  test("clicking skills pencil switches to skills form", async () => {
    await renderPage();
    const pencils = screen.getAllByText("✎");
    await act(async () => {
      fireEvent.click(pencils[0]);
    });
    expect(screen.getByText(/Save Skills/i)).toBeInTheDocument();
  });

  test("clicking experience pencil switches to experience form", async () => {
    await renderPage();
    const pencils = screen.getAllByText("✎");
    await act(async () => {
      fireEvent.click(pencils[1]);
    });
    expect(screen.getByText(/Save Experiences/i)).toBeInTheDocument();
  });

  test("worker name is displayed", async () => {
    await renderPage();
    expect(screen.getByText(/Test/i)).toBeInTheDocument();
  });
});

describe("ProfilePage — employer view", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renders Business Description for employer", async () => {
    jest
      .spyOn(require("../../components/UserContext"), "useUser")
      .mockReturnValue({
        user: {
          id: 2,
          isbusiness: true,
          firstname: "Biz",
          lastname: "Owner",
          email: "biz@test.com",
          business_name: "Acme Corp",
          business_description: "We do things",
        },
        setUser: jest.fn(),
        logout: jest.fn(),
      });

    await act(async () => {
      render(
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      );
    });

    expect(screen.getByText(/Business Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Business Information/i)).toBeInTheDocument();
  });
});