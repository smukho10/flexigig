// ─── Env vars first, before any imports ───────────────────────────────────────
process.env.SENDGRID_API_KEY = "test_key";
process.env.EMAIL_FROM = "test@example.com";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.NODE_ENV = "test";

// ─── Mock @sendgrid/mail ───────────────────────────────────────────────────────
jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

// ─── Mock DB + query layer ─────────────────────────────────────────────────────
jest.mock("../../src/database/connection.js", () => ({
  query: jest.fn(),
}));

jest.mock("../../src/database/queries/user_queries.js", () => ({
  getUserByEmail: jest.fn(),
  addUser: jest.fn(),
  addWorker: jest.fn(),
  addBusiness: jest.fn(),
  saveVerificationToken: jest.fn(),
  getUserById: jest.fn(),
  setCurrentSession: jest.fn(),
  insertOrUpdateToken: jest.fn(),
  validateToken: jest.fn(),
  checkLoginCredentials: jest.fn(),
  getUserResetToken: jest.fn(),
  deleteUserResetToken: jest.fn(),
  saveUserResetToken: jest.fn(),
  getUserIdAndToken: jest.fn(),
  updateUserPassword: jest.fn(),
  getNotifications: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
  // Messaging queries
  getConversationPartners: jest.fn(),
  getMessageHistory: jest.fn(),
  sendMessage: jest.fn(),
  markMessagesAsRead: jest.fn(),
  getLatestMessages: jest.fn(),
  getUnreadCount: jest.fn(),
}));

jest.mock("../../src/database/queries/workers_queries.js", () => ({
  addWorkerSkill: jest.fn(),
  addWorkerExperience: jest.fn(),
  addWorkerTrait: jest.fn(),
}));

jest.mock("../../src/database/queries/job_queries.js", () => ({
  fetchRecommendedJobs: jest.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────────────────
const request = require("supertest");
const app = require("../../src/app");
const userQueries = require("../../src/database/queries/user_queries.js");

const userRouter = require("../../src/database/routes/user_routes.js");
app.use("/api", userRouter);

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const PARTNERS = [
  { partner_id: 10, job_id: 5, job_title: "Bartender", latest_message_at: "2024-01-02T10:00:00Z" },
  { partner_id: 20, job_id: 6, job_title: "Driver",    latest_message_at: "2024-01-01T08:00:00Z" },
];

const MESSAGES = [
  { sender_id: 1,  receiver_id: 10, content: "Hello there", timestamp: "2024-01-02T09:00:00Z", is_system: false },
  { sender_id: 10, receiver_id: 1,  content: "Hi back",     timestamp: "2024-01-02T09:01:00Z", is_system: false },
];

const NEW_MESSAGE = {
  sender_id: 1, receiver_id: 10, content: "New msg",
  timestamp: "2024-01-02T10:00:00Z", is_system: false,
};

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/conversation-partners/:userId
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/conversation-partners/:userId", () => {
  test("200 + returns partners list on success", async () => {
    userQueries.getConversationPartners.mockResolvedValueOnce(PARTNERS);

    const res = await request(app).get("/api/conversation-partners/1");

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.partners).toEqual(PARTNERS);
    expect(userQueries.getConversationPartners).toHaveBeenCalledWith("1");
  });

  test("200 + returns empty array when user has no conversations", async () => {
    userQueries.getConversationPartners.mockResolvedValueOnce([]);

    const res = await request(app).get("/api/conversation-partners/99");

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.partners).toEqual([]);
  });

  test("500 when database query throws", async () => {
    userQueries.getConversationPartners.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get("/api/conversation-partners/1");

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/internal server error/i);
  });

  test("passes userId from URL param to query function", async () => {
    userQueries.getConversationPartners.mockResolvedValueOnce([]);

    await request(app).get("/api/conversation-partners/42");

    expect(userQueries.getConversationPartners).toHaveBeenCalledWith("42");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/message-history
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/message-history", () => {
  test("200 + returns messages when senderId and receiverId are provided", async () => {
    userQueries.getMessageHistory.mockResolvedValueOnce(MESSAGES);

    const res = await request(app)
      .get("/api/message-history")
      .query({ senderId: "1", receiverId: "10" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.messages).toEqual(MESSAGES);
    expect(userQueries.getMessageHistory).toHaveBeenCalledWith("1", "10", null);
  });

  test("200 + passes jobId to query when provided", async () => {
    userQueries.getMessageHistory.mockResolvedValueOnce(MESSAGES);

    const res = await request(app)
      .get("/api/message-history")
      .query({ senderId: "1", receiverId: "10", jobId: "5" });

    expect(res.statusCode).toBe(200);
    expect(userQueries.getMessageHistory).toHaveBeenCalledWith("1", "10", "5");
  });

  test("200 + returns empty array when no messages exist", async () => {
    userQueries.getMessageHistory.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/message-history")
      .query({ senderId: "1", receiverId: "10" });

    expect(res.statusCode).toBe(200);
    expect(res.body.messages).toEqual([]);
  });

  test("400 when senderId is missing", async () => {
    const res = await request(app)
      .get("/api/message-history")
      .query({ receiverId: "10" });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing senderId or receiverId/i);
    expect(userQueries.getMessageHistory).not.toHaveBeenCalled();
  });

  test("400 when receiverId is missing", async () => {
    const res = await request(app)
      .get("/api/message-history")
      .query({ senderId: "1" });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing senderId or receiverId/i);
    expect(userQueries.getMessageHistory).not.toHaveBeenCalled();
  });

  test("400 when both senderId and receiverId are missing", async () => {
    const res = await request(app).get("/api/message-history");

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(userQueries.getMessageHistory).not.toHaveBeenCalled();
  });

  test("500 when database query throws", async () => {
    userQueries.getMessageHistory.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/message-history")
      .query({ senderId: "1", receiverId: "10" });

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/internal server error/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/send-message
// ══════════════════════════════════════════════════════════════════════════════
describe("POST /api/send-message", () => {
  test("200 + returns created message on success", async () => {
    userQueries.sendMessage.mockResolvedValueOnce(NEW_MESSAGE);

    const res = await request(app)
      .post("/api/send-message")
      .send({ senderId: 1, receiverId: 10, content: "New msg" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toEqual(NEW_MESSAGE);
    expect(userQueries.sendMessage).toHaveBeenCalledWith(1, 10, "New msg", null, false);
  });

  test("200 + passes jobId when provided", async () => {
    userQueries.sendMessage.mockResolvedValueOnce(NEW_MESSAGE);

    const res = await request(app)
      .post("/api/send-message")
      .send({ senderId: 1, receiverId: 10, content: "New msg", jobId: 5 });

    expect(res.statusCode).toBe(200);
    expect(userQueries.sendMessage).toHaveBeenCalledWith(1, 10, "New msg", 5, false);
  });

  test("200 + passes isSystem=true for system messages", async () => {
    const sysMsg = { ...NEW_MESSAGE, is_system: true };
    userQueries.sendMessage.mockResolvedValueOnce(sysMsg);

    const res = await request(app)
      .post("/api/send-message")
      .send({ senderId: 1, receiverId: 10, content: "System notice", isSystem: true });

    expect(res.statusCode).toBe(200);
    expect(userQueries.sendMessage).toHaveBeenCalledWith(1, 10, "System notice", null, true);
  });

  test("400 when senderId is missing", async () => {
    const res = await request(app)
      .post("/api/send-message")
      .send({ receiverId: 10, content: "Hello" });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing senderId, receiverId, or content/i);
    expect(userQueries.sendMessage).not.toHaveBeenCalled();
  });

  test("400 when receiverId is missing", async () => {
    const res = await request(app)
      .post("/api/send-message")
      .send({ senderId: 1, content: "Hello" });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing senderId, receiverId, or content/i);
    expect(userQueries.sendMessage).not.toHaveBeenCalled();
  });

  test("400 when content is missing", async () => {
    const res = await request(app)
      .post("/api/send-message")
      .send({ senderId: 1, receiverId: 10 });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing senderId, receiverId, or content/i);
    expect(userQueries.sendMessage).not.toHaveBeenCalled();
  });

  test("400 when all required fields are missing", async () => {
    const res = await request(app).post("/api/send-message").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(userQueries.sendMessage).not.toHaveBeenCalled();
  });

  test("500 when database query throws", async () => {
    userQueries.sendMessage.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/send-message")
      .send({ senderId: 1, receiverId: 10, content: "Hello" });

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/internal server error/i);
  });

  test("jobId defaults to null when not provided", async () => {
    userQueries.sendMessage.mockResolvedValueOnce(NEW_MESSAGE);

    await request(app)
      .post("/api/send-message")
      .send({ senderId: 1, receiverId: 10, content: "No job context" });

    expect(userQueries.sendMessage).toHaveBeenCalledWith(
      1, 10, "No job context", null, false
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/mark-as-read
// ══════════════════════════════════════════════════════════════════════════════
describe("PUT /api/mark-as-read", () => {
  test("200 on success", async () => {
    userQueries.markMessagesAsRead.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .put("/api/mark-as-read")
      .send({ receiverId: 1, senderId: 10 });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(userQueries.markMessagesAsRead).toHaveBeenCalledWith(1, 10);
  });

  test("400 when receiverId is missing", async () => {
    const res = await request(app)
      .put("/api/mark-as-read")
      .send({ senderId: 10 });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing receiverId or senderId/i);
    expect(userQueries.markMessagesAsRead).not.toHaveBeenCalled();
  });

  test("400 when senderId is missing", async () => {
    const res = await request(app)
      .put("/api/mark-as-read")
      .send({ receiverId: 1 });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing receiverId or senderId/i);
    expect(userQueries.markMessagesAsRead).not.toHaveBeenCalled();
  });

  test("400 when body is empty", async () => {
    const res = await request(app).put("/api/mark-as-read").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(userQueries.markMessagesAsRead).not.toHaveBeenCalled();
  });

  test("500 when database query throws", async () => {
    userQueries.markMessagesAsRead.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .put("/api/mark-as-read")
      .send({ receiverId: 1, senderId: 10 });

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/internal server error/i);
  });

  test("passes correct ids to markMessagesAsRead", async () => {
    userQueries.markMessagesAsRead.mockResolvedValueOnce(undefined);

    await request(app)
      .put("/api/mark-as-read")
      .send({ receiverId: 7, senderId: 42 });

    expect(userQueries.markMessagesAsRead).toHaveBeenCalledWith(7, 42);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/unread-count/:userId
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/unread-count/:userId", () => {
  test("200 + returns unread count on success", async () => {
    userQueries.getUnreadCount.mockResolvedValueOnce(3);

    const res = await request(app).get("/api/unread-count/1");

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.unreadCount).toBe(3);
    expect(userQueries.getUnreadCount).toHaveBeenCalledWith("1");
  });

  test("200 + returns 0 when no unread messages", async () => {
    userQueries.getUnreadCount.mockResolvedValueOnce(0);

    const res = await request(app).get("/api/unread-count/1");

    expect(res.statusCode).toBe(200);
    expect(res.body.unreadCount).toBe(0);
  });

  test("500 when database query throws", async () => {
    userQueries.getUnreadCount.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get("/api/unread-count/1");

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/internal server error/i);
  });
});
