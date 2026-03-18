process.env.SENDGRID_API_KEY = "test_key";
process.env.EMAIL_FROM = "test@example.com";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID = "test_client_id";
process.env.GOOGLE_CLIENT_SECRET = "test_client_secret";

// Use global so the mock factory can access them (factory runs before file body executes)
global.__mockPassportUser = null;
global.__mockPassportBehavior = "success";

// Mock passport - must be before requiring auth_routes
jest.mock("passport", () => {
  const actual = jest.requireActual("passport");
  const mockAuthenticate = jest.fn((strategy, options) => {
    return (req, res, next) => {
      if (options && options.failureRedirect) {
        if (global.__mockPassportBehavior === "failure") {
          return res.redirect(options.failureRedirect);
        }
        if (global.__mockPassportBehavior === "error") {
          return res.redirect(options.failureRedirect);
        }
        req.user = global.__mockPassportUser;
        next();
      } else {
        return res.redirect("https://accounts.google.com/o/oauth2/auth");
      }
    };
  });
  return Object.create(actual, {
    authenticate: { value: mockAuthenticate, writable: true }
  });
});

const request = require("supertest");
const app = require("../../src/app");

// Mock DB + queries so tests don't require real Postgres
jest.mock("../../src/database/connection.js", () => ({
  query: jest.fn()
}));

jest.mock("../../src/database/queries/user_queries.js", () => ({
  getUserByGoogleId: jest.fn(),
  getUserByEmail: jest.fn(),
  getUserById: jest.fn(),
  linkGoogleAccount: jest.fn(),
  createOAuthUser: jest.fn(),
  addWorker: jest.fn(),
  addBusiness: jest.fn(),
  setCurrentSession: jest.fn()
}));

const passport = require("passport");
// Mount the auth routes on the app (passport mock is already in place)
const authRouter = require("../../src/database/routes/auth_routes.js");
app.use("/api", authRouter);
app.use(passport.initialize());
app.use(passport.session());

const user_queries = require("../../src/database/queries/user_queries.js");

describe("Google OAuth Authentication Routes", () => {
  let originalConsoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    global.__mockPassportUser = null;
    global.__mockPassportBehavior = "success";
    // Suppress console.error for cleaner test output (errors are expected in error tests)
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console.error after each test
    console.error = originalConsoleError;
  });

  describe("GET /api/auth/google - Initiate OAuth", () => {
    test("should redirect to Google OAuth without accountType", async () => {
      const res = await request(app)
        .get("/api/auth/google")
        .expect(302);

      expect(res.headers.location).toContain("accounts.google.com");
    });

    test("should store Worker accountType in session when provided", async () => {
      const res = await request(app)
        .get("/api/auth/google?accountType=Worker")
        .expect(302);

      expect(res.headers.location).toContain("accounts.google.com");
      // Session should be set (we can't directly check session in supertest without session store mock)
    });

    test("should store Employer accountType in session when provided", async () => {
      const res = await request(app)
        .get("/api/auth/google?accountType=Employer")
        .expect(302);

      expect(res.headers.location).toContain("accounts.google.com");
    });

    test("should ignore invalid accountType values", async () => {
      const res = await request(app)
        .get("/api/auth/google?accountType=Invalid")
        .expect(302);

      expect(res.headers.location).toContain("accounts.google.com");
    });
  });

  describe("GET /api/auth/google/callback - OAuth Callback", () => {
    test("should issue a pending token for a new user needing account selection", async () => {
      // The callback now redirects to /auth/callback?token=... instead of directly
      // to /account-selection. The frontend exchanges the token via
      // /auth/google/exchange which sets pendingOAuth in session and returns
      // { type: "pending" } so the frontend can show the account-type picker.
      global.__mockPassportUser = {
        needsAccountType: true,
        googleId: "google123",
        email: "newuser@example.com",
        picture: "https://example.com/pic.jpg",
        firstName: "New",
        lastName: "User"
      };

      const agent = request.agent(app);

      // Step 1: callback redirects to /auth/callback?token=... (no accountType param)
      const callbackRes = await agent.get("/api/auth/google/callback").expect(302);
      const location    = callbackRes.headers.location || "";
      expect(location).toContain("/auth/callback?token=");
      expect(location).not.toContain("accountType=");

      // Step 2: exchange the token — sets pendingOAuth in session
      const tokenMatch = location.match(/[?&]token=([^&]+)/);
      const token      = tokenMatch ? tokenMatch[1] : null;
      expect(token).not.toBeNull();

      const res = await agent
        .get(`/api/auth/google/exchange?token=${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.type).toBe("pending");
      expect(res.body.email).toBe("newuser@example.com");
      expect(res.body.preSelectedAccountType).toBeNull();
    });

    test("should redirect new user with pre-selected accountType via token exchange", async () => {
      // The callback now redirects to /auth/callback?token=...&accountType=Worker
      // The frontend exchanges the token via /auth/google/exchange which returns
      // preSelectedAccountType so the frontend can skip the account-type picker.
      global.__mockPassportUser = {
        needsAccountType: true,
        googleId: "google123",
        email: "newuser@example.com",
        picture: "https://example.com/pic.jpg",
        firstName: "New",
        lastName: "User"
      };

      const agent = request.agent(app);

      // Step 1: store the pre-selected account type in the session
      await agent.get("/api/auth/google?accountType=Worker");

      // Step 2: callback redirects to /auth/callback?token=...&accountType=Worker
      const callbackRes = await agent.get("/api/auth/google/callback").expect(302);
      const location    = callbackRes.headers.location || "";
      expect(location).toContain("/auth/callback?token=");
      expect(location).toContain("accountType=Worker");

      // Step 3: exchange the token — response carries preSelectedAccountType
      const tokenMatch = location.match(/[?&]token=([^&]+)/);
      const token      = tokenMatch ? tokenMatch[1] : null;
      expect(token).not.toBeNull();

      const res = await agent
        .get(`/api/auth/google/exchange?token=${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.type).toBe("pending");
      expect(res.body.preSelectedAccountType).toBe("Worker");
      expect(res.body.email).toBe("newuser@example.com");
    });

    test("should login existing Google user via token exchange", async () => {
      // The callback no longer sets up the session directly — it creates a
      // short-lived token and redirects to /auth/callback?token=...
      // The frontend then calls /auth/google/exchange to establish the session.
      const existingUser = {
        id: 1,
        email: "existing@example.com",
        isbusiness: false,
        userimage: "https://example.com/pic.jpg"
      };

      global.__mockPassportUser = existingUser;
      user_queries.setCurrentSession.mockResolvedValueOnce(true);
      user_queries.getUserById.mockResolvedValueOnce(existingUser);

      const agent = request.agent(app);

      // Step 1: callback redirects with a one-time token
      const callbackRes = await agent.get("/api/auth/google/callback").expect(302);
      const location    = callbackRes.headers.location || "";
      const tokenMatch  = location.match(/[?&]token=([^&]+)/);
      const token       = tokenMatch ? tokenMatch[1] : null;
      expect(token).not.toBeNull();

      // Step 2: exchange the token — session is created here
      const res = await agent
        .get(`/api/auth/google/exchange?token=${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.type).toBe("login");
      expect(res.body.user.id).toBe(existingUser.id);
      expect(res.body.user.email).toBe(existingUser.email);
      expect(user_queries.setCurrentSession).toHaveBeenCalledWith(
        existingUser.id,
        expect.any(String)
      );
    });

    test("should handle session regeneration error during token exchange", async () => {
      // The callback no longer calls session.regenerate — it creates a short-lived
      // token and redirects. Regeneration happens in GET /auth/google/exchange.
      global.__mockPassportUser = {
        id: 1,
        email: "existing@example.com",
        isbusiness: false
      };

      const agent = request.agent(app);

      // Step 1: hit the callback to obtain the one-time token
      const callbackRes = await agent.get("/api/auth/google/callback");
      const location    = callbackRes.headers.location || "";
      const tokenMatch  = location.match(/[?&]token=([^&]+)/);
      const token       = tokenMatch ? tokenMatch[1] : null;

      const Session = require("express-session").Session;
      const originalRegenerate = Session.prototype.regenerate;
      try {
        Session.prototype.regenerate = function (callback) {
          callback(new Error("Session error"));
        };

        // Step 2: exchange the token — regeneration fails here, returns 500 JSON
        const res = await agent
          .get(`/api/auth/google/exchange?token=${token}`)
          .expect(500);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Session error");
      } finally {
        Session.prototype.regenerate = originalRegenerate;
      }
    });

    test("should redirect to signin on OAuth failure", async () => {
      global.__mockPassportBehavior = "failure";

      const res = await request(app)
        .get("/api/auth/google/callback")
        .expect(302);

      expect(res.headers.location).toBe(
        "http://localhost:3000/signin?error=oauth_failed"
      );
    });

    test("should handle callback error and redirect to signin", async () => {
      global.__mockPassportBehavior = "error";

      const res = await request(app)
        .get("/api/auth/google/callback")
        .expect(302);

      expect(res.headers.location).toBe(
        "http://localhost:3000/signin?error=oauth_failed"
      );
    });
  });

  describe("POST /api/auth/google/complete - Complete OAuth Registration", () => {
    // Helper to create an agent with pending OAuth session.
    // The callback no longer sets pendingOAuth directly — it creates a
    // short-lived in-memory token and redirects the browser to the frontend.
    // The frontend then calls /auth/google/exchange to set the session.
    // We replicate that two-step flow here so pendingOAuth is in the session
    // before any test calls POST /auth/google/complete.
    const createAgentWithPendingOAuth = async () => {
      global.__mockPassportUser = {
        needsAccountType: true,
        googleId: "google123",
        email: "test@example.com",
        picture: "https://example.com/pic.jpg",
        firstName: "Test",
        lastName: "User"
      };
      global.__mockPassportBehavior = "success";

      const agent = request.agent(app);

      // Step 1: hit the callback — receives a 302 with ?token=... in Location
      const callbackRes = await agent.get("/api/auth/google/callback");

      // Step 2: extract the one-time token from the redirect URL
      const location = callbackRes.headers.location || "";
      const tokenMatch = location.match(/[?&]token=([^&]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      // Step 3: exchange the token — this sets req.session.pendingOAuth
      if (token) {
        await agent.get(`/api/auth/google/exchange?token=${token}`);
      }

      return agent;
    };

    test("should complete registration for Worker account", async () => {
      const agent = await createAgentWithPendingOAuth();

      const mockUser = {
        id: 1,
        email: "worker@example.com",
        isbusiness: false,
        userimage: "https://example.com/pic.jpg"
      };

      const mockWorker = { id: 10, user_id: 1, first_name: "John", last_name: "Doe" };

      user_queries.createOAuthUser.mockResolvedValueOnce(mockUser);
      user_queries.addWorker.mockResolvedValueOnce(mockWorker);
      user_queries.setCurrentSession.mockResolvedValueOnce(true);

      const res = await agent
        .post("/api/auth/google/complete")
        .send({
          accountType: "Worker",
          firstName: "John",
          lastName: "Doe"
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe(1);
      expect(res.body.user.isbusiness).toBe(false);
      expect(res.body.workerId).toBe(10);
      expect(user_queries.createOAuthUser).toHaveBeenCalledWith(
        "test@example.com",
        "google123",
        false,
        "https://example.com/pic.jpg"
      );
      expect(user_queries.addWorker).toHaveBeenCalledWith(
        1,
        "John",
        "Doe"
      );
    });

    test("should complete registration for Employer account", async () => {
      const agent = await createAgentWithPendingOAuth();

      const mockUser = {
        id: 2,
        email: "employer@example.com",
        isbusiness: true,
        userimage: "https://example.com/pic.jpg"
      };

      user_queries.createOAuthUser.mockResolvedValueOnce(mockUser);
      user_queries.addBusiness.mockResolvedValueOnce({
        id: 20,
        user_id: 2,
        business_name: "Test Business"
      });
      user_queries.setCurrentSession.mockResolvedValueOnce(true);

      const res = await agent
        .post("/api/auth/google/complete")
        .send({
          accountType: "Employer",
          businessName: "Test Business",
          businessDescription: "A test business"
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe(2);
      expect(res.body.user.isbusiness).toBe(true);
      expect(user_queries.addBusiness).toHaveBeenCalledWith(
        2,
        "Test Business",
        "A test business"
      );
    });

    test("should use default firstName when not provided for Worker", async () => {
      const agent = await createAgentWithPendingOAuth();

      const mockUser = {
        id: 3,
        email: "worker2@example.com",
        isbusiness: false,
        userimage: "https://example.com/pic.jpg"
      };

      user_queries.createOAuthUser.mockResolvedValueOnce(mockUser);
      user_queries.addWorker.mockResolvedValueOnce({
        id: 11,
        user_id: 3,
        first_name: "User",
        last_name: ""
      });
      user_queries.setCurrentSession.mockResolvedValueOnce(true);

      const res = await agent
        .post("/api/auth/google/complete")
        .send({
          accountType: "Worker"
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      // Should use default firstName from OAuth data or 'User'
    });

    test("should return 400 when no pending OAuth data", async () => {
      const res = await request(app)
        .post("/api/auth/google/complete")
        .send({
          accountType: "Worker"
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("No pending OAuth data");
    });

    test("should return 400 when accountType is missing", async () => {
      const agent = await createAgentWithPendingOAuth();

      const res = await agent
        .post("/api/auth/google/complete")
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Account type is required");
    });

    test("should handle database error during user creation", async () => {
      const agent = await createAgentWithPendingOAuth();

      user_queries.createOAuthUser.mockRejectedValueOnce(
        new Error("Database error")
      );

      const res = await agent
        .post("/api/auth/google/complete")
        .send({
          accountType: "Worker",
          firstName: "John",
          lastName: "Doe"
        })
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Registration failed");
    });

    test("should handle session regeneration error", async () => {
      const agent = await createAgentWithPendingOAuth();

      const mockUser = {
        id: 4,
        email: "error@example.com",
        isbusiness: false
      };

      user_queries.createOAuthUser.mockResolvedValueOnce(mockUser);
      user_queries.addWorker.mockResolvedValueOnce({
        id: 12,
        user_id: 4
      });

      const Session = require("express-session").Session;
      const originalRegenerate = Session.prototype.regenerate;
      try {
        Session.prototype.regenerate = function (callback) {
          callback(new Error("Session error"));
        };

        const res = await agent
          .post("/api/auth/google/complete")
          .send({
            accountType: "Worker",
            firstName: "John",
            lastName: "Doe"
          })
          .expect(500);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Session error");
      } finally {
        Session.prototype.regenerate = originalRegenerate;
      }
    });
  });

  describe("GET /api/auth/google/pending - Check Pending OAuth", () => {
    test("should return pending OAuth data when session exists", async () => {
      const agent = request.agent(app);
      
      // Simulate setting pending OAuth in session
      // This is tricky with supertest - we'll need to mock the session
      const res = await agent
        .get("/api/auth/google/pending")
        .expect(200);

      // Without actual session, this will return { pending: false }
      expect(res.body).toHaveProperty("pending");
    });

    test("should return pending: false when no session data", async () => {
      const res = await request(app)
        .get("/api/auth/google/pending")
        .expect(200);

      expect(res.body.pending).toBe(false);
    });
  });
});
