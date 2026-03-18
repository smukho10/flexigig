import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock("axios", () => ({
  get:   jest.fn(),
  post:  jest.fn(),
  patch: jest.fn(),
}));

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ user: { id: 1, isbusiness: true } }),
}));

jest.mock("../../components/JobPosting", () => ({
  JOB_STATUS: { DRAFT: "draft", OPEN: "open" },
}));

// Keep SaveTemplateModal out of the picture — it's not under test here
jest.mock("../../components/SaveTemplateModal", () => () => null);

import JobPostingForm from "../../components/JobPostingForm";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const fullTemplate = {
  template_id:         1,
  template_name:       "Weekend Bartender",
  job_title:           "Bartender",
  job_type:            "Hospitality",
  job_description:     "Weekend bar shift",
  hourly_rate:         25,
  street_address:      "123 King St",
  city:                "Toronto",
  province:            "Ontario",
  postal_code:         "M5V 2T6",
  required_skills:     ["Communication", "Customer Service"],
  required_experience: ["Hospitality Services"],
};

const emptyTemplate = {
  template_id:         2,
  template_name:       "Minimal Template",
  job_title:           null,
  job_type:            null,
  job_description:     null,
  hourly_rate:         null,
  street_address:      null,
  city:                null,
  province:            null,
  postal_code:         null,
  required_skills:     [],
  required_experience: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const renderForm = () =>
  render(<JobPostingForm setDone={jest.fn()} onBackClick={{ current: null }} />);

// Wait until a named template option appears in the select
const waitForTemplate = async (name) =>
  waitFor(() =>
    expect(screen.getByRole("option", { name })).toBeInTheDocument()
  );

// The TemplateLoader <select> always shows "Load Template" as its placeholder
const getTemplateSelect = () => screen.getByDisplayValue("Load Template");

// Confirm a .msd-tag chip with the given text is rendered
const expectTag = (text) =>
  expect(
    screen.getByText((content, el) =>
      el?.tagName === "SPAN" &&
      el?.className?.includes("msd-tag") &&
      content.includes(text)
    )
  ).toBeInTheDocument();

// Confirm no .msd-tag chip with the given text is rendered
const expectNoTag = (text) =>
  expect(
    screen.queryByText((content, el) =>
      el?.tagName === "SPAN" &&
      el?.className?.includes("msd-tag") &&
      content.includes(text)
    )
  ).not.toBeInTheDocument();

// ── Test suite ────────────────────────────────────────────────────────────────
describe("JobPostingForm — template autofill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { templates: [fullTemplate] } });
  });

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  describe("template fetch on mount", () => {
    test("calls GET /api/templates on render", () => {
      renderForm();
      expect(axios.get).toHaveBeenCalledWith("/api/templates", {
        withCredentials: true,
      });
    });

    test("populates the template select with fetched template names", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      expect(
        screen.getByRole("option", { name: "Weekend Bartender" })
      ).toBeInTheDocument();
    });

    test("shows only a placeholder when the user has no templates", async () => {
      axios.get.mockResolvedValueOnce({ data: { templates: [] } });
      renderForm();

      // Let the async fetch settle
      await waitFor(() =>
        expect(axios.get).toHaveBeenCalledTimes(1)
      );

      // No template-specific options beyond the placeholder
      expect(
        screen.queryByRole("option", { name: "Weekend Bartender" })
      ).not.toBeInTheDocument();
    });
  });

  // ── Autofill: text fields ───────────────────────────────────────────────────
  describe("selecting a template autofills text fields", () => {
    test("fills job title and job type", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      fireEvent.change(getTemplateSelect(), { target: { value: "1" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Job Title")).toHaveValue("Bartender");
        expect(screen.getByLabelText("Job Type")).toHaveValue("Hospitality");
      });
    });

    test("fills job description", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      fireEvent.change(getTemplateSelect(), { target: { value: "1" } });

      await waitFor(() =>
        expect(screen.getByLabelText("Job Description")).toHaveValue(
          "Weekend bar shift"
        )
      );
    });

    test("fills hourly rate", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      fireEvent.change(getTemplateSelect(), { target: { value: "1" } });

      await waitFor(() =>
        expect(screen.getByLabelText("Hourly Rate ($)")).toHaveValue(25)
      );
    });

    test("fills street address, city, and postal code", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      fireEvent.change(getTemplateSelect(), { target: { value: "1" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Street Address")).toHaveValue("123 King St");
        expect(screen.getByLabelText("City")).toHaveValue("Toronto");
        expect(screen.getByLabelText("Postal Code")).toHaveValue("M5V 2T6");
      });
    });

    test("fills the province dropdown", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      fireEvent.change(getTemplateSelect(), { target: { value: "1" } });

      await waitFor(() =>
        expect(screen.getByLabelText("Province")).toHaveValue("Ontario")
      );
    });
  });

  // ── Autofill: skills & experience ──────────────────────────────────────────
  describe("selecting a template autofills skills and experience", () => {
    test("renders required skill tags", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      fireEvent.change(getTemplateSelect(), { target: { value: "1" } });

      await waitFor(() => {
        expectTag("Communication");
        expectTag("Customer Service");
      });
    });

    test("renders required experience tags", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      fireEvent.change(getTemplateSelect(), { target: { value: "1" } });

      await waitFor(() => expectTag("Hospitality Services"));
    });

    test("shows no skill or experience tags before a template is selected", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      expectNoTag("Communication");
      expectNoTag("Hospitality Services");
    });
  });

  // ── Date fields are preserved ───────────────────────────────────────────────
  describe("date fields are not overwritten by template selection", () => {
    test("preserves jobStart and jobEnd after autofill", async () => {
      renderForm();
      await waitForTemplate("Weekend Bartender");

      fireEvent.change(screen.getByLabelText("Job Start Date, Time"), {
        target: { value: "2025-06-01T09:00" },
      });
      fireEvent.change(screen.getByLabelText("Job End Date, Time"), {
        target: { value: "2025-06-01T17:00" },
      });

      fireEvent.change(getTemplateSelect(), { target: { value: "1" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Job Start Date, Time")).toHaveValue(
          "2025-06-01T09:00"
        );
        expect(screen.getByLabelText("Job End Date, Time")).toHaveValue(
          "2025-06-01T17:00"
        );
      });
    });
  });

  // ── Null / missing field handling ──────────────────────────────────────────
  describe("templates with null fields", () => {
    test("produces empty strings for null text fields", async () => {
      axios.get.mockResolvedValueOnce({
        data: { templates: [emptyTemplate] },
      });

      renderForm();
      await waitForTemplate("Minimal Template");

      fireEvent.change(getTemplateSelect(), { target: { value: "2" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Job Title")).toHaveValue("");
        expect(screen.getByLabelText("Job Type")).toHaveValue("");
        expect(screen.getByLabelText("City")).toHaveValue("");
        expect(screen.getByLabelText("Postal Code")).toHaveValue("");
      });
    });

    test("renders no skill or experience tags when arrays are empty", async () => {
      axios.get.mockResolvedValueOnce({
        data: { templates: [emptyTemplate] },
      });

      renderForm();
      await waitForTemplate("Minimal Template");

      fireEvent.change(getTemplateSelect(), { target: { value: "2" } });

      await waitFor(() => {
        expectNoTag("Communication");
        expectNoTag("Hospitality Services");
      });
    });
  });
});
