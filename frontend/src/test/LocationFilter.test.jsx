import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import WorkerBoard from "../components/WorkerBoard";
import axios from "axios";

jest.mock("axios");

describe("Location Filter UI Tests", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({
      data: [
        { jobtitle: "Cleaner", city: "Toronto" },
        { jobtitle: "Driver", city: "Vancouver" },
      ],
    });
  });

  test("renders location input", () => {
    render(<WorkerBoard />);
    const input = screen.getByPlaceholderText(/location/i);
    expect(input).toBeInTheDocument();
  });

  test("filters results by city input", async () => {
    render(<WorkerBoard />);

    const input = screen.getByPlaceholderText(/location/i);

    fireEvent.change(input, { target: { value: "Toronto" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(axios.get).toHaveBeenCalled();
  });

  test("handles empty input (no crash)", async () => {
    render(<WorkerBoard />);

    const input = screen.getByPlaceholderText(/location/i);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(axios.get).toHaveBeenCalled();
  });

  test("handles invalid location input", async () => {
    render(<WorkerBoard />);

    const input = screen.getByPlaceholderText(/location/i);

    fireEvent.change(input, { target: { value: "@@@###" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(axios.get).toHaveBeenCalled();
  });

  test("displays no results message", async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    render(<WorkerBoard />);

    const input = screen.getByPlaceholderText(/location/i);

    fireEvent.change(input, { target: { value: "Nowhere" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    const message = await screen.findByText(/no results/i);
    expect(message).toBeInTheDocument();
  });
});