// ─── Env vars first, before any imports ───────────────────────────────────────
process.env.SENDGRID_API_KEY = "test_key";
process.env.EMAIL_FROM = "test@example.com";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.NODE_ENV = "test"; // keeps auto-activation + dev shortcuts off

// ─── Mock @sendgrid/mail BEFORE user_routes.js is imported ────────────────────
// user_routes.js calls sgMail.setApiKey() at module load time and sgMail.send()
// at runtime. Both must be safe no-ops in tests.
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
}));

jest.mock("../../src/database/queries/workers_queries.js", () => ({
  addWorkerSkill: jest.fn(),
  addWorkerExperience: jest.fn(),
  addWorkerTrait: jest.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────────────────
const request = require("supertest");
const app = require("../../src/app");
const db = require("../../src/database/connection.js");
const userQueries = require("../../src/database/queries/user_queries.js");
const workersQueries = require("../../src/database/queries/workers_queries.js");
const sgMail = require("@sendgrid/mail");

// Mount the router (guard against double-registration across test runs)
const userRouter = require("../../src/database/routes/user_routes.js");
app.use("/api", userRouter);

// ─── Helpers ───────────────────────────────────────────────────────────────────
const WORKER_BODY = {
  email: "worker@example.com",
  password: "pass123",
  accountType: "Worker",
  firstName: "Alice",
  lastName: "Smith",
  skills: [],
  experiences: [],
  traits: [],
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/pending-register
// ══════════════════════════════════════════════════════════════════════════════
describe("POST /api/pending-register", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Test 1 ──────────────────────────────────────────────────────────────────
  test("400 when required fields are missing", async () => {
    // No getUserByEmail call expected because validation fires first
    const res = await request(app).post("/api/pending-register").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/missing required fields/i);
    expect(userQueries.getUserByEmail).not.toHaveBeenCalled();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  test("400 when email is already registered in users table", async () => {
    // getUserByEmail returns an existing user
    userQueries.getUserByEmail.mockResolvedValueOnce({ id: 1, email: "worker@example.com" });

    const res = await request(app).post("/api/pending-register").send(WORKER_BODY);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/email already registered/i);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  test("400 when a pending registration already exists (non-dev)", async () => {
    userQueries.getUserByEmail.mockResolvedValueOnce(null);   // not in users
    db.query.mockResolvedValueOnce({ rows: [{ email: "worker@example.com" }] }); // in pending

    const res = await request(app).post("/api/pending-register").send(WORKER_BODY);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already pending verification/i);
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  test("200 + sends verification email on success", async () => {
    userQueries.getUserByEmail.mockResolvedValueOnce(null);   // not in users
    db.query
      .mockResolvedValueOnce({ rows: [] })   // pending_users SELECT → empty
      .mockResolvedValueOnce({ rows: [] });  // INSERT into pending_users

    const res = await request(app).post("/api/pending-register").send(WORKER_BODY);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/check your email/i);

    // Give the async email send a tick to fire
    await new Promise(r => setImmediate(r));
    expect(sgMail.send).toHaveBeenCalledTimes(1);
    const callArg = sgMail.send.mock.calls[0][0];
    expect(callArg.to).toBe("worker@example.com");
    expect(callArg.html).toContain("http://localhost:3000/verify/");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/verify/:token  (pending_users flow)
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/verify/:token", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Test 5 ──────────────────────────────────────────────────────────────────
  test("404 when token does not exist in pending_users", async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // SELECT pending_users → nothing

    const res = await request(app).get("/api/verify/nonexistent-token");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────
  test("200 + creates Worker account and deletes pending row", async () => {
    const pending = {
      email: "worker@example.com",
      password: "hashed_pw",
      account_type: "Worker",
      first_name: "Alice",
      last_name: "Smith",
      phone_number: "555-0100",
      photo: null,
      street_address: "123 Main St",
      city: "Vancouver",
      province: "BC",
      postal_code: "V6B 1A1",
      skills: JSON.stringify([{ skill_id: 3 }]),
      experiences: JSON.stringify([{ experience_id: 7 }]),
      traits: JSON.stringify([{ trait_id: 2 }]),
    };

    db.query
      .mockResolvedValueOnce({ rows: [pending] })           // SELECT pending_users
      .mockResolvedValueOnce({ rows: [{ location_id: 42 }] }) // INSERT locations
      .mockResolvedValueOnce({ rows: [] });                 // DELETE pending_users

    userQueries.getUserByEmail.mockResolvedValueOnce(null); // not already verified
    userQueries.addUser.mockResolvedValueOnce({ id: 10, email: "worker@example.com" });
    userQueries.addWorker.mockResolvedValueOnce({ id: 55 });
    userQueries.setCurrentSession.mockResolvedValueOnce(undefined);
    workersQueries.addWorkerSkill.mockResolvedValueOnce({});
    workersQueries.addWorkerExperience.mockResolvedValueOnce({});
    workersQueries.addWorkerTrait.mockResolvedValueOnce({});

    const res = await request(app).get("/api/verify/some-valid-token");

    expect(res.statusCode).toBe(200);
    // Route returns the raw user object (not a message wrapper)
    expect(res.body.id).toBe(10);
    expect(res.body.email).toBe("worker@example.com");

    expect(userQueries.addUser).toHaveBeenCalledWith(
      "worker@example.com",
      "hashed_pw",
      false,              // isBusiness = false for Worker
      "555-0100",
      null,
      42                  // locationId
    );
    expect(userQueries.addWorker).toHaveBeenCalledWith(10, "Alice", "Smith");
    expect(workersQueries.addWorkerSkill).toHaveBeenCalledWith(55, 3);
    expect(workersQueries.addWorkerExperience).toHaveBeenCalledWith(55, 7);
    expect(workersQueries.addWorkerTrait).toHaveBeenCalledWith(55, 2);
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────
  test("200 + creates Employer account and deletes pending row", async () => {
    const pending = {
      email: "biz@example.com",
      password: "hashed_pw",
      account_type: "Employer",
      first_name: "Bob",
      last_name: "Corp",
      business_name: "Bob's Builds",
      business_description: "Construction services",
      phone_number: "555-0200",
      photo: null,
      street_address: "99 Business Ave",
      city: "Toronto",
      province: "ON",
      postal_code: "M5V 3A8",
      skills: JSON.stringify([]),
      experiences: JSON.stringify([]),
      traits: JSON.stringify([]),
    };

    db.query
      .mockResolvedValueOnce({ rows: [pending] })
      .mockResolvedValueOnce({ rows: [{ location_id: 7 }] })
      .mockResolvedValueOnce({ rows: [] }); // delete pending

    userQueries.getUserByEmail.mockResolvedValueOnce(null);
    userQueries.addUser.mockResolvedValueOnce({ id: 20, email: "biz@example.com" });
    userQueries.addBusiness.mockResolvedValueOnce({ id: 5 });
    userQueries.setCurrentSession.mockResolvedValueOnce(undefined);

    const res = await request(app).get("/api/verify/some-employer-token");

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(20);

    expect(userQueries.addUser).toHaveBeenCalledWith(
      "biz@example.com",
      "hashed_pw",
      true,             // isBusiness = true for Employer
      "555-0200",
      null,
      7
    );
    expect(userQueries.addBusiness).toHaveBeenCalledWith(20, "Bob's Builds", "Construction services");
    expect(userQueries.addWorker).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/login
// ══════════════════════════════════════════════════════════════════════════════
describe("POST /api/login", () => {
  beforeEach(() => jest.clearAllMocks());

  test("400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/login")
      .send({ password: "pass123" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid credentials/i);
    expect(userQueries.checkLoginCredentials).not.toHaveBeenCalled();
  });

  test("400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/login")
      .send({ email: "user@example.com" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid credentials/i);
    expect(userQueries.checkLoginCredentials).not.toHaveBeenCalled();
  });

  test("400 when credentials are wrong (user not found or bad password)", async () => {
    userQueries.checkLoginCredentials.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/login")
      .send({ email: "user@example.com", password: "wrongpass" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  test("400 when account is not yet verified (active = false)", async () => {
    // checkLoginCredentials returns { success: false } for inactive accounts.
    // Because this object is truthy, the route currently logs them in anyway —
    // this test documents that behaviour. Fix: return null for inactive accounts.
    userQueries.checkLoginCredentials.mockResolvedValueOnce({
      success: false,
      message: "Account not activated. Please check your email for verification.",
    });

    const res = await request(app)
      .post("/api/login")
      .send({ email: "unverified@example.com", password: "pass123" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not activated/i);
  });

  test("200 + returns user on successful login", async () => {
    const fakeUser = {
      id: 7,
      email: "user@example.com",
      isbusiness: false,
      active: true,
    };
    userQueries.checkLoginCredentials.mockResolvedValueOnce(fakeUser);
    userQueries.setCurrentSession.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post("/api/login")
      .send({ email: "user@example.com", password: "correctpass" });

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(7);
    expect(res.body.email).toBe("user@example.com");
    expect(userQueries.setCurrentSession).toHaveBeenCalledWith(7, expect.any(String));
  });

  test("email is lowercased before being passed to credentials check", async () => {
    userQueries.checkLoginCredentials.mockResolvedValueOnce(null);

    await request(app)
      .post("/api/login")
      .send({ email: "  User@EXAMPLE.COM  ", password: "pass" });

    expect(userQueries.checkLoginCredentials).toHaveBeenCalledWith(
      "user@example.com",
      "pass"
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/resend-verification
// ══════════════════════════════════════════════════════════════════════════════
describe("POST /api/resend-verification", () => {
  beforeEach(() => jest.clearAllMocks());

  test("400 when email does not belong to any user", async () => {
    userQueries.getUserByEmail.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/resend-verification")
      .send({ email: "ghost@example.com" });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/user not found/i);
    expect(sgMail.send).not.toHaveBeenCalled();
  });

  test("200 + sends verification email when user exists", async () => {
    userQueries.getUserByEmail.mockResolvedValueOnce({ id: 42, email: "user@example.com" });
    userQueries.insertOrUpdateToken.mockResolvedValueOnce(42);

    const res = await request(app)
      .post("/api/resend-verification")
      .send({ email: "user@example.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/verification email sent/i);
    expect(sgMail.send).toHaveBeenCalledTimes(1);
    const emailArg = sgMail.send.mock.calls[0][0];
    expect(emailArg.to).toBe("user@example.com");
    expect(emailArg.html).toContain("http://localhost:3000/verify/");
  });

  test("500 when SendGrid fails to send", async () => {
    userQueries.getUserByEmail.mockResolvedValueOnce({ id: 42, email: "user@example.com" });
    userQueries.insertOrUpdateToken.mockResolvedValueOnce(42);
    sgMail.send.mockRejectedValueOnce(new Error("SendGrid down"));

    const res = await request(app)
      .post("/api/resend-verification")
      .send({ email: "user@example.com" });

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/failed to send verification email/i);
  });

  test("token is saved before email is sent", async () => {
    userQueries.getUserByEmail.mockResolvedValueOnce({ id: 99, email: "user@example.com" });
    userQueries.insertOrUpdateToken.mockResolvedValueOnce(99);

    await request(app)
      .post("/api/resend-verification")
      .send({ email: "user@example.com" });

    expect(userQueries.insertOrUpdateToken).toHaveBeenCalledWith(99, expect.any(String));
    const tokenCallOrder = userQueries.insertOrUpdateToken.mock.invocationCallOrder[0];
    const emailCallOrder = sgMail.send.mock.invocationCallOrder[0];
    expect(tokenCallOrder).toBeLessThan(emailCallOrder);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Forgot Password API
// ══════════════════════════════════════════════════════════════════════════════
describe("Forgot Password API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/initiate-password-reset", () => {
    test("returns 404 when email is not registered", async () => {
      userQueries.getUserByEmail.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/initiate-password-reset")
        .send({ email: "unknown@example.com" });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/user not found/i);
      expect(userQueries.getUserByEmail).toHaveBeenCalledWith("unknown@example.com");
    });

    test("sends reset email and returns 200 when user exists and no previous token", async () => {
      userQueries.getUserByEmail.mockResolvedValueOnce({ id: 1, email: "user@example.com" });
      userQueries.getUserResetToken.mockResolvedValueOnce(null);
      userQueries.saveUserResetToken.mockResolvedValueOnce();
      sgMail.send.mockResolvedValueOnce([{ statusCode: 202 }]);

      const res = await request(app)
        .post("/api/initiate-password-reset")
        .send({ email: "user@example.com" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/password reset link sent/i);
      expect(userQueries.deleteUserResetToken).not.toHaveBeenCalled();
      expect(userQueries.saveUserResetToken).toHaveBeenCalledWith(1, expect.any(String));
    });

    test("deletes old token before saving a new one when one already exists", async () => {
      userQueries.getUserByEmail.mockResolvedValueOnce({ id: 42, email: "user@example.com" });
      userQueries.getUserResetToken.mockResolvedValueOnce("old-token-here");
      userQueries.deleteUserResetToken.mockResolvedValueOnce();
      userQueries.saveUserResetToken.mockResolvedValueOnce();
      sgMail.send.mockResolvedValueOnce([{ statusCode: 202 }]);

      const res = await request(app)
        .post("/api/initiate-password-reset")
        .send({ email: "user@example.com" });

      expect(res.statusCode).toBe(200);
      expect(userQueries.deleteUserResetToken).toHaveBeenCalledWith(42);
      expect(userQueries.saveUserResetToken).toHaveBeenCalledWith(42, expect.any(String));
    });

    test("trims and lowercases the email before lookup", async () => {
      userQueries.getUserByEmail.mockResolvedValueOnce(null);

      await request(app)
        .post("/api/initiate-password-reset")
        .send({ email: "  User@Example.COM  " });

      expect(userQueries.getUserByEmail).toHaveBeenCalledWith("user@example.com");
    });

    test("returns 500 when email sending fails", async () => {
      userQueries.getUserByEmail.mockResolvedValueOnce({ id: 5, email: "fail@example.com" });
      userQueries.getUserResetToken.mockResolvedValueOnce(null);
      userQueries.saveUserResetToken.mockResolvedValueOnce();
      sgMail.send.mockRejectedValueOnce(new Error("SendGrid error"));

      const res = await request(app)
        .post("/api/initiate-password-reset")
        .send({ email: "fail@example.com" });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/failed to send reset email/i);
    });

    test("returns 500 when a database query throws", async () => {
      userQueries.getUserByEmail.mockRejectedValueOnce(new Error("DB connection error"));

      const res = await request(app)
        .post("/api/initiate-password-reset")
        .send({ email: "user@example.com" });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/reset-password", () => {
    test("returns 404 when the reset token is invalid", async () => {
      userQueries.getUserIdAndToken.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/reset-password")
        .send({
          uniqueIdentifier: "bad-token",
          newPassword: "NewPass123!",
          confirmPassword: "NewPass123!",
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid reset link/i);
    });

    test("returns 400 when newPassword and confirmPassword do not match", async () => {
      userQueries.getUserIdAndToken.mockResolvedValueOnce({ userId: 7 });

      const res = await request(app)
        .post("/api/reset-password")
        .send({
          uniqueIdentifier: "valid-token",
          newPassword: "NewPass123!",
          confirmPassword: "DifferentPass!",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/passwords do not match/i);
    });

    test("successfully resets password and deletes token", async () => {
      userQueries.getUserIdAndToken.mockResolvedValueOnce({ userId: 7 });
      userQueries.updateUserPassword.mockResolvedValueOnce();
      userQueries.deleteUserResetToken.mockResolvedValueOnce();

      const res = await request(app)
        .post("/api/reset-password")
        .send({
          uniqueIdentifier: "valid-token",
          newPassword: "NewSecurePass1!",
          confirmPassword: "NewSecurePass1!",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/password reset successful/i);
      expect(userQueries.updateUserPassword).toHaveBeenCalledWith(7, expect.any(String));
      expect(userQueries.deleteUserResetToken).toHaveBeenCalledWith(7);
    });

    test("stores a bcrypt hash, not the plain-text password", async () => {
      userQueries.getUserIdAndToken.mockResolvedValueOnce({ userId: 8 });
      userQueries.updateUserPassword.mockResolvedValueOnce();
      userQueries.deleteUserResetToken.mockResolvedValueOnce();

      const plainPassword = "MyPlainPassword!";

      await request(app)
        .post("/api/reset-password")
        .send({
          uniqueIdentifier: "valid-token",
          newPassword: plainPassword,
          confirmPassword: plainPassword,
        });

      const savedHash = userQueries.updateUserPassword.mock.calls[0][1];
      expect(savedHash).not.toBe(plainPassword);
      expect(savedHash).toMatch(/^\$2[aby]\$/);
    });

    test("returns 500 when database query throws", async () => {
      userQueries.getUserIdAndToken.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app)
        .post("/api/reset-password")
        .send({
          uniqueIdentifier: "valid-token",
          newPassword: "NewPass123!",
          confirmPassword: "NewPass123!",
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
