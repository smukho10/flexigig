import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock("axios", () => ({
  post: jest.fn(),
}));

import SaveTemplateModal from "../../components/SaveTemplateModal";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const fullJobPost = {
  jobTitle:           "Bartender",
  jobType:            "Hospitality",
  jobDescription:     "Weekend bar shift",
  hourlyRate:         "25",
  jobStreetAddress:   "123 King St",
  jobCity:            "Toronto",
  jobProvince:        "Ontario",
  jobPostalCode:      "M5V 2T6",
  requiredSkills:     ["Communication", "Customer Service"],
  requiredExperience: ["Hospitality Services"],
};

const emptyJobPost = {
  jobTitle: "", jobType: "", jobDescription: "",
  hourlyRate: "", jobStreetAddress: "", jobCity: "",
  jobProvince: "", jobPostalCode: "",
  requiredSkills: [], requiredExperience: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const renderModal = (jobPost = fullJobPost, overrides = {}) => {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  render(
    <SaveTemplateModal
      jobPost={jobPost}
      onClose={onClose}
      onSaved={onSaved}
      {...overrides}
    />
  );
  return { onClose, onSaved };
};

const getNameInput   = ()  => screen.getByLabelText("Template Name");
const getSaveButton  = ()  => screen.getByRole("button", { name: /save template/i });
const getCancelButton = () => screen.getByRole("button", { name: /cancel/i });
const typeName       = (name) =>
  fireEvent.change(getNameInput(), { target: { value: name } });

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("SaveTemplateModal — save template", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Rendering ───────────────────────────────────────────────────────────────
  describe("rendering", () => {
    test("renders the modal heading and name input", () => {
      renderModal();
      expect(screen.getByText("Save as Template")).toBeInTheDocument();
      expect(getNameInput()).toBeInTheDocument();
      expect(getSaveButton()).toBeInTheDocument();
      expect(getCancelButton()).toBeInTheDocument();
    });

    test("input starts empty", () => {
      renderModal();
      expect(getNameInput()).toHaveValue("");
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────────
  describe("client-side validation", () => {
    test("shows error when saving with an empty name", async () => {
      renderModal();
      fireEvent.click(getSaveButton());

      expect(
        await screen.findByText("Please enter a template name.")
      ).toBeInTheDocument();
      expect(axios.post).not.toHaveBeenCalled();
    });

    test("shows error when name is only whitespace", async () => {
      renderModal();
      typeName("   ");
      fireEvent.click(getSaveButton());

      expect(
        await screen.findByText("Please enter a template name.")
      ).toBeInTheDocument();
      expect(axios.post).not.toHaveBeenCalled();
    });

    test("clears a previous error when Save is clicked again with a valid name", async () => {
      axios.post.mockResolvedValueOnce({});
      renderModal();

      // Trigger the validation error
      fireEvent.click(getSaveButton());
      await screen.findByText("Please enter a template name.");

      // Type a valid name and click Save — setError("") fires before the POST
      typeName("Fixed Name");
      fireEvent.click(getSaveButton());

      await waitFor(() =>
        expect(
          screen.queryByText("Please enter a template name.")
        ).not.toBeInTheDocument()
      );
    });
  });

  // ── POST payload ────────────────────────────────────────────────────────────
  describe("POST /api/templates payload", () => {
    test("sends all job post fields and the trimmed template name", async () => {
      axios.post.mockResolvedValueOnce({});
      renderModal();

      typeName("  My Template  ");
      fireEvent.click(getSaveButton());

      await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

      expect(axios.post).toHaveBeenCalledWith(
        "/api/templates",
        {
          template_name:      "My Template",
          jobTitle:           "Bartender",
          jobType:            "Hospitality",
          jobDescription:     "Weekend bar shift",
          hourlyRate:         "25",
          jobStreetAddress:   "123 King St",
          jobCity:            "Toronto",
          jobProvince:        "Ontario",
          jobPostalCode:      "M5V 2T6",
          requiredSkills:     ["Communication", "Customer Service"],
          requiredExperience: ["Hospitality Services"],
        },
        { withCredentials: true }
      );
    });

    test("includes requiredSkills and requiredExperience in the payload", async () => {
      axios.post.mockResolvedValueOnce({});
      renderModal();

      typeName("Skills Test");
      fireEvent.click(getSaveButton());

      await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

      const payload = axios.post.mock.calls[0][1];
      expect(payload.requiredSkills).toEqual(["Communication", "Customer Service"]);
      expect(payload.requiredExperience).toEqual(["Hospitality Services"]);
    });

    test("sends empty arrays when jobPost has no skills or experience", async () => {
      axios.post.mockResolvedValueOnce({});
      renderModal(emptyJobPost);

      typeName("Empty Skills");
      fireEvent.click(getSaveButton());

      await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

      const payload = axios.post.mock.calls[0][1];
      expect(payload.requiredSkills).toEqual([]);
      expect(payload.requiredExperience).toEqual([]);
    });
  });

  // ── Success path ────────────────────────────────────────────────────────────
  describe("on successful save", () => {
    test("calls onSaved then onClose after a successful POST", async () => {
      axios.post.mockResolvedValueOnce({});
      const { onClose, onSaved } = renderModal();

      typeName("My Template");
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ── Loading state ───────────────────────────────────────────────────────────
  describe("loading state while saving", () => {
    test('shows "Saving..." and disables buttons while the POST is in flight', async () => {
      // Never resolves during this test so we can inspect the in-flight state
      axios.post.mockReturnValueOnce(new Promise(() => {}));
      renderModal();

      typeName("My Template");
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
        expect(getCancelButton()).toBeDisabled();
      });
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────
  describe("error handling", () => {
    test("shows the API error message when the server returns one", async () => {
      axios.post.mockRejectedValueOnce({
        response: { data: { message: "You can only save up to 10 templates." } },
      });
      renderModal();

      typeName("My Template");
      fireEvent.click(getSaveButton());

      expect(
        await screen.findByText("You can only save up to 10 templates.")
      ).toBeInTheDocument();
    });

    test("shows a generic error message when the server returns no message", async () => {
      axios.post.mockRejectedValueOnce(new Error("Network Error"));
      renderModal();

      typeName("My Template");
      fireEvent.click(getSaveButton());

      expect(
        await screen.findByText("Failed to save template.")
      ).toBeInTheDocument();
    });

    test("re-enables buttons and resets saving state after an error", async () => {
      axios.post.mockRejectedValueOnce({ response: { data: { message: "Error" } } });
      renderModal();

      typeName("My Template");
      fireEvent.click(getSaveButton());

      await screen.findByText("Error");

      expect(getSaveButton()).not.toBeDisabled();
      expect(getCancelButton()).not.toBeDisabled();
    });

    test("does not call onClose or onSaved on error", async () => {
      axios.post.mockRejectedValueOnce({ response: { data: { message: "Error" } } });
      const { onClose, onSaved } = renderModal();

      typeName("My Template");
      fireEvent.click(getSaveButton());

      await screen.findByText("Error");

      expect(onSaved).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Keyboard & overlay interactions ─────────────────────────────────────────
  describe("keyboard and overlay interactions", () => {
    test("pressing Enter triggers save", async () => {
      axios.post.mockResolvedValueOnce({});
      const { onSaved } = renderModal();

      typeName("Keyboard Save");
      fireEvent.keyDown(getNameInput(), { key: "Enter" });

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    });

    test("pressing Escape calls onClose without saving", () => {
      const { onClose } = renderModal();

      fireEvent.keyDown(getNameInput(), { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test("clicking the overlay calls onClose", () => {
      const { onClose } = renderModal();

      fireEvent.click(screen.getByText("Save as Template").closest(".template-modal-overlay") || document.querySelector(".template-modal-overlay"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("clicking the modal content does not close the modal", () => {
      const { onClose } = renderModal();

      fireEvent.click(document.querySelector(".template-modal"));

      expect(onClose).not.toHaveBeenCalled();
    });

    test("clicking the Cancel button calls onClose", () => {
      const { onClose } = renderModal();

      fireEvent.click(getCancelButton());

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
