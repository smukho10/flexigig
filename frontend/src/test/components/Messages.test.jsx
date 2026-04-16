import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import axios from "axios";

jest.mock("axios", () => ({
  get:  jest.fn(),
  post: jest.fn(),
  put:  jest.fn(),
}));

jest.mock("../../components/UserContext", () => ({
  useUser: () => ({ user: { id: 1 } }),
}));

const mockNavigate = jest.fn();
let mockLocationState = {};

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ state: mockLocationState, pathname: "/messages" }),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../assets/images/ChevronLeft.png",  () => "chevron.png");
jest.mock("../../assets/images/DefaultAvatar.png", () => "avatar.png");
jest.mock("../../styles/Messages.css", () => ({}));

import Messages from "../../components/Messages";

const PARTNERS = [
  { partner_id: 10, job_id: 5, job_title: "Bartender", latest_message_at: "2024-01-02T10:00:00Z" },
  { partner_id: 20, job_id: 6, job_title: "Driver",    latest_message_at: "2024-01-01T08:00:00Z" },
];

const MESSAGES = [
  { sender_id: 1,  receiver_id: 10, content: "Hello there", timestamp: "2024-01-02T09:00:00Z", is_system: false },
  { sender_id: 10, receiver_id: 1,  content: "Hi back",     timestamp: "2024-01-02T09:01:00Z", is_system: false },
];

const mockPartnerDetails = (partnerId) => ({
  data: {
    userDetails: { type: "worker", firstName: `User${partnerId}`, lastName: "Test", businessName: null },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockLocationState = {};

  axios.get.mockImplementation((url) => {
    if (url.includes("conversation-partners")) return Promise.resolve({ data: { partners: PARTNERS } });
    if (url.includes("user-details"))          return Promise.resolve(mockPartnerDetails(10));
    if (url.includes("view-photo-url"))        return Promise.resolve({ data: { viewUrl: null } });
    if (url.includes("message-history"))       return Promise.resolve({ data: { messages: MESSAGES } });
    return Promise.reject(new Error(`Unmocked GET: ${url}`));
  });

  axios.put.mockResolvedValue({ data: { success: true } });
  axios.post.mockResolvedValue({ data: { message: { sender_id: 1, receiver_id: 10, content: "New msg", timestamp: "2024-01-02T10:00:00Z", is_system: false } } });
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe("Messages — rendering", () => {
  test("renders the messages header and search bar", async () => {
    render(<Messages />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
      expect(screen.getByText("Messages")).toBeInTheDocument();
    });
  });

  test("shows 'No Chats Selected' when no conversation is open", async () => {
    render(<Messages />);
    await waitFor(() => {
      expect(screen.getByText("No Chats Selected")).toBeInTheDocument();
    });
  });
});

// ── Conversation partners ─────────────────────────────────────────────────────

describe("Messages — conversation partners", () => {
  test("fetches and displays conversation partners on mount", async () => {
    render(<Messages />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/conversation-partners/1",
        expect.objectContaining({ withCredentials: true })
      );
    });
  });

  test("polls conversation partners every 10 seconds", async () => {
    render(<Messages />);
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/api/conversation-partners/1", expect.anything()
    ));

    const callsBefore = axios.get.mock.calls.filter(c => c[0].includes("conversation-partners")).length;
    act(() => jest.advanceTimersByTime(10000));

    await waitFor(() => {
      const callsAfter = axios.get.mock.calls.filter(c => c[0].includes("conversation-partners")).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});

// ── Selecting a conversation ──────────────────────────────────────────────────

describe("Messages — selecting a conversation", () => {
  test("fetches message history when a partner is clicked", async () => {
    render(<Messages />);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0)
    );

    const items = screen.getAllByRole("listitem");
    fireEvent.click(items[0]);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/message-history",
        expect.objectContaining({ withCredentials: true })
      );
    });
  });

  test("displays messages in the chat area after selecting a partner", async () => {
    render(<Messages />);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0)
    );

    fireEvent.click(screen.getAllByRole("listitem")[0]);

    await waitFor(() => {
      expect(screen.getByText("Hello there")).toBeInTheDocument();
      expect(screen.getByText("Hi back")).toBeInTheDocument();
    });
  });

  test("marks messages as read when a conversation is opened", async () => {
    render(<Messages />);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0)
    );

    fireEvent.click(screen.getAllByRole("listitem")[0]);

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/mark-as-read",
        expect.objectContaining({ receiverId: 1 }),
        expect.objectContaining({ withCredentials: true })
      );
    });
  });
});

// ── Sending messages ──────────────────────────────────────────────────────────

describe("Messages — sending", () => {
  const openConversation = async () => {
    render(<Messages />);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByRole("listitem")[0]);
    await waitFor(() => screen.getByPlaceholderText("Type a message..."));
  };

  test("send button calls POST /api/send-message with correct payload", async () => {
    await openConversation();
    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "New msg" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/send-message",
        expect.objectContaining({ senderId: 1, content: "New msg" }),
        expect.objectContaining({ withCredentials: true })
      );
    });
  });

  test("clears the input after sending", async () => {
    await openConversation();
    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "New msg" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  test("does not send when message input is empty", async () => {
    await openConversation();
    fireEvent.click(screen.getByText("Send"));
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("pressing Enter sends the message", async () => {
    await openConversation();
    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Enter msg" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/send-message",
        expect.objectContaining({ content: "Enter msg" }),
        expect.anything()
      );
    });
  });
});

// ── Polling ───────────────────────────────────────────────────────────────────

describe("Messages — 1s message polling", () => {
  test("polls message history every second when a conversation is open", async () => {
    render(<Messages />);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByRole("listitem")[0]);
    await waitFor(() => screen.getByPlaceholderText("Type a message..."));

    const before = axios.get.mock.calls.filter(c => c[0].includes("message-history")).length;
    act(() => jest.advanceTimersByTime(3000));

    await waitFor(() => {
      const after = axios.get.mock.calls.filter(c => c[0].includes("message-history")).length;
      expect(after).toBeGreaterThanOrEqual(before + 2);
    });
  });
});

// ── Navigation via location.state ────────────────────────────────────────────

describe("Messages — navigation state", () => {
  test("auto-selects partner and fetches history when navigated with partnerId", async () => {
    mockLocationState = { partnerId: 10, jobId: 5, jobTitle: "Bartender" };
    render(<Messages />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/message-history",
        expect.objectContaining({ withCredentials: true })
      );
    });
  });
});

// ── Quick replies ─────────────────────────────────────────────────────────────

describe("Messages — quick replies", () => {
  test("clicking a quick reply sends that text", async () => {
    render(<Messages />);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByRole("listitem")[0]);
    await waitFor(() => screen.getByText("On my way"));

    fireEvent.click(screen.getByText("On my way"));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/send-message",
        expect.objectContaining({ content: "On my way" }),
        expect.objectContaining({ withCredentials: true })
      );
    });
  });
});
