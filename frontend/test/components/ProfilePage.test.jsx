// frontend/test/components/ProfilePage.test.jsx

// Ensure setup env (jest-dom) is loaded via package.json setupFilesAfterEnv -> src/setupTests.js

import React from "react";
import { render, screen } from "@testing-library/react";

// mock axios so no real network calls occur
jest.mock("axios", () => ({
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} }))
}));

// mock the useUser hook used by ProfilePage
jest.mock("../../src/components/UserContext", () => ({
  useUser: () => ({
    user: { id: 1, isbusiness: false, firstname: "Test", lastname: "User" },
    setUser: jest.fn(),
    logout: jest.fn()
  }),
  // if you also import UserProvider in app code, export it too
  UserProvider: ({ children }) => children
}));

import ProfilePage from "../../src/components/ProfilePage";

describe("ProfilePage (external test folder)", () => {
  test("renders worker Biography section", async () => {
    render(<ProfilePage />);
    expect(await screen.findByText(/Biography/i)).toBeInTheDocument();
  });
});