process.env.NODE_ENV = "test";

const request = require("supertest");
const express = require("express");

// Mock the query layer
jest.mock("../../src/database/queries/calendar_queries.js", () => ({
  getScheduleByUserId: jest.fn(),
  setSchedule: jest.fn(),
  deleteEvent: jest.fn(),
  getScheduleByWorkerId: jest.fn(),
  setWorkerSchedule: jest.fn(),
}));

const calendarQueries = require("../../src/database/queries/calendar_queries.js");

// Setup express app with the router
const app = express();
app.use(express.json());
const calendarRouter = require("../../src/database/routes/calendar-routes.js");
app.use("/api", calendarRouter);

describe("Calendar Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/my-calendar/:user_id", () => {
    test("returns 200 and the user schedule on success", async () => {
      const mockSchedule = [
        { id: 1, title: "Shift 1", startDate: "2026-04-20" },
        { id: 2, title: "Shift 2", startDate: "2026-04-21" },
      ];
      calendarQueries.getScheduleByUserId.mockResolvedValueOnce(mockSchedule);

      const userId = "42";
      const res = await request(app).get(`/api/my-calendar/${userId}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe("Shift 1");
      expect(calendarQueries.getScheduleByUserId).toHaveBeenCalledWith(userId);
    });

    test("returns 500 when database query fails", async () => {
      calendarQueries.getScheduleByUserId.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).get("/api/my-calendar/42");

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
    });
  });

  describe("POST /api/my-calendar", () => {
    test("returns 201 and created schedule on success", async () => {
      const mockCreated = { id: 10, title: "New Shift" };
      calendarQueries.setSchedule.mockResolvedValueOnce(mockCreated);

      const payload = {
        user_id: 42,
        startDate: "2026-04-22",
        endDate: "2026-04-22",
        startTime: "09:00",
        endTime: "17:00",
        title: "New Shift"
      };

      const res = await request(app).post("/api/my-calendar").send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.id).toBe(10);
      expect(calendarQueries.setSchedule).toHaveBeenCalledWith(
        42, "2026-04-22", "2026-04-22", "09:00", "17:00", "New Shift"
      );
    });

    test("returns 400 if required fields are missing", async () => {
      const payload = { user_id: 42, title: "New Shift" }; // Missing dates, times

      const res = await request(app).post("/api/my-calendar").send(payload);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe("Missing required fields");
      expect(calendarQueries.setSchedule).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/my-calendar/:eventId", () => {
    test("returns 200 on successful deletion", async () => {
      calendarQueries.deleteEvent.mockResolvedValueOnce();

      const res = await request(app).delete("/api/my-calendar/10");

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Event deleted successfully");
      expect(calendarQueries.deleteEvent).toHaveBeenCalledWith("10");
    });

    test("returns 500 on database error", async () => {
      calendarQueries.deleteEvent.mockRejectedValueOnce(new Error("DB Error"));

      const res = await request(app).delete("/api/my-calendar/10");

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe("Internal Server Error");
    });
  });

  describe("GET /api/my-calendar/worker/:worker_id", () => {
    test("returns 200 and worker schedule", async () => {
      const mockSchedule = [{ id: 3, title: "Worker Shift" }];
      calendarQueries.getScheduleByWorkerId.mockResolvedValueOnce(mockSchedule);

      const res = await request(app).get("/api/my-calendar/worker/100");

      expect(res.statusCode).toBe(200);
      expect(res.body[0].title).toBe("Worker Shift");
      expect(calendarQueries.getScheduleByWorkerId).toHaveBeenCalledWith("100");
    });
  });

  describe("POST /api/my-calendar/worker", () => {
    test("returns 201 on success", async () => {
      const mockCreated = { id: 4, title: "Added Worker Shift" };
      calendarQueries.setWorkerSchedule.mockResolvedValueOnce(mockCreated);

      const payload = {
        user_id: 42,
        worker_id: 100,
        startDate: "2026-04-23",
        endDate: "2026-04-23",
        startTime: "08:00",
        endTime: "16:00",
        title: "Added Worker Shift"
      };

      const res = await request(app).post("/api/my-calendar/worker").send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.title).toBe("Added Worker Shift");
      expect(calendarQueries.setWorkerSchedule).toHaveBeenCalled();
    });
  });
});
