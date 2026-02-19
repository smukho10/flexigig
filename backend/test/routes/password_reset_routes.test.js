
process.env.SENDGRID_API_KEY = "test_key";
process.env.EMAIL_FROM = "test@example.com";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../../src/app");


jest.mock("../../src/database/connection.js", () => ({
    query: jest.fn(),
}));
jest.mock("../../src/database/queries/user_queries.js", () => ({
    getUserByEmail: jest.fn(),
    getUserResetToken: jest.fn(),
    deleteUserResetToken: jest.fn(),
    saveUserResetToken: jest.fn(),
    getUserIdAndToken: jest.fn(),
    updateUserPassword: jest.fn(),
    checkLoginCredentials: jest.fn(),
    getUserById: jest.fn(),
    addUser: jest.fn(),
    addWorker: jest.fn(),
    addBusiness: jest.fn(),
    saveVerificationToken: jest.fn(),
    insertOrUpdateToken: jest.fn(),
    validateToken: jest.fn(),
    setCurrentSession: jest.fn(),
    clearCurrentSessionIfMatch: jest.fn(),
    getConversationPartners: jest.fn(),
    getMessageHistory: jest.fn(),
    sendMessage: jest.fn(),
    getLatestMessages: jest.fn(),
    getUserDetails: jest.fn(),
    createOAuthUser: jest.fn(),
}));

jest.mock("../../src/database/queries/workers_queries.js", () => ({
    addWorkerSkill: jest.fn(),
    addWorkerExperience: jest.fn(),
    addWorkerTrait: jest.fn(),
    fetchWorkers: jest.fn(),
    getAllSkills: jest.fn(),
    getAllExperiences: jest.fn(),
    getAllTraits: jest.fn(),
    clearWorkerSkills: jest.fn(),
    clearWorkerExperiences: jest.fn(),
    clearWorkerTraits: jest.fn(),
    getWorkerSkills: jest.fn(),
    getWorkerSkillsWithId: jest.fn(),
    getWorkerExperiences: jest.fn(),
    getWorkerExperiencesWithId: jest.fn(),
    getWorkerTraits: jest.fn(),
    getWorkerTraitsWithId: jest.fn(),
}));

jest.mock("@sendgrid/mail", () => ({
    setApiKey: jest.fn(),
    send: jest.fn(),
}));
const userRouter = require("../../src/database/routes/user_routes");
app.use("/api", userRouter);

const user_queries = require("../../src/database/queries/user_queries.js");
const sgMail = require("@sendgrid/mail");

const mockEmailSuccess = () =>
    sgMail.send.mockResolvedValueOnce([{ statusCode: 202 }]);

const mockEmailFailure = () =>
    sgMail.send.mockRejectedValueOnce(new Error("SendGrid error"));

describe("Forgot Password API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("POST /api/initiate-password-reset", () => {
        test("returns 404 when email is not registered", async () => {
            user_queries.getUserByEmail.mockResolvedValueOnce(null);

            const res = await request(app)
                .post("/api/initiate-password-reset")
                .send({ email: "unknown@example.com" });

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/user not found/i);
            expect(user_queries.getUserByEmail).toHaveBeenCalledWith("unknown@example.com");
        });

        test("sends reset email and returns 200 when user exists and no previous token", async () => {
            user_queries.getUserByEmail.mockResolvedValueOnce({ id: 1, email: "user@example.com" });
            user_queries.getUserResetToken.mockResolvedValueOnce(null);
            user_queries.saveUserResetToken.mockResolvedValueOnce();
            mockEmailSuccess();

            const res = await request(app)
                .post("/api/initiate-password-reset")
                .send({ email: "user@example.com" });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/password reset link sent/i);
            expect(user_queries.deleteUserResetToken).not.toHaveBeenCalled();
            expect(user_queries.saveUserResetToken).toHaveBeenCalledWith(1, expect.any(String));
        });

        test("deletes old token before saving a new one when one already exists", async () => {
            user_queries.getUserByEmail.mockResolvedValueOnce({ id: 42, email: "user@example.com" });
            user_queries.getUserResetToken.mockResolvedValueOnce("old-token-here");
            user_queries.deleteUserResetToken.mockResolvedValueOnce();
            user_queries.saveUserResetToken.mockResolvedValueOnce();
            mockEmailSuccess();

            const res = await request(app)
                .post("/api/initiate-password-reset")
                .send({ email: "user@example.com" });

            expect(res.statusCode).toBe(200);
            expect(user_queries.deleteUserResetToken).toHaveBeenCalledWith(42);
            expect(user_queries.saveUserResetToken).toHaveBeenCalledWith(42, expect.any(String));
        });

        test("trims and lowercases the email before lookup", async () => {
            user_queries.getUserByEmail.mockResolvedValueOnce(null);

            await request(app)
                .post("/api/initiate-password-reset")
                .send({ email: "  User@Example.COM  " });

            expect(user_queries.getUserByEmail).toHaveBeenCalledWith("user@example.com");
        });

        test("returns 500 when email sending fails", async () => {
            user_queries.getUserByEmail.mockResolvedValueOnce({ id: 5, email: "fail@example.com" });
            user_queries.getUserResetToken.mockResolvedValueOnce(null);
            user_queries.saveUserResetToken.mockResolvedValueOnce();
            mockEmailFailure();

            const res = await request(app)
                .post("/api/initiate-password-reset")
                .send({ email: "fail@example.com" });

            expect(res.statusCode).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/failed to send reset email/i);
        });

        test("returns 500 when a database query throws", async () => {
            user_queries.getUserByEmail.mockRejectedValueOnce(new Error("DB connection error"));

            const res = await request(app)
                .post("/api/initiate-password-reset")
                .send({ email: "user@example.com" });

            expect(res.statusCode).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });


    describe("POST /api/reset-password", () => {
        test("returns 404 when the reset token is invalid", async () => {
            user_queries.getUserIdAndToken.mockResolvedValueOnce(null);

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
            user_queries.getUserIdAndToken.mockResolvedValueOnce({ userId: 7 });

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
            user_queries.getUserIdAndToken.mockResolvedValueOnce({ userId: 7 });
            user_queries.updateUserPassword.mockResolvedValueOnce();
            user_queries.deleteUserResetToken.mockResolvedValueOnce();

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
            expect(user_queries.updateUserPassword).toHaveBeenCalledWith(7, expect.any(String));
            expect(user_queries.deleteUserResetToken).toHaveBeenCalledWith(7);
        });

        test("stores a bcrypt hash, not the plain-text password", async () => {
            user_queries.getUserIdAndToken.mockResolvedValueOnce({ userId: 8 });
            user_queries.updateUserPassword.mockResolvedValueOnce();
            user_queries.deleteUserResetToken.mockResolvedValueOnce();

            const plainPassword = "MyPlainPassword!";

            await request(app)
                .post("/api/reset-password")
                .send({
                    uniqueIdentifier: "valid-token",
                    newPassword: plainPassword,
                    confirmPassword: plainPassword,
                });

            const savedHash = user_queries.updateUserPassword.mock.calls[0][1];
            expect(savedHash).not.toBe(plainPassword);
            expect(savedHash).toMatch(/^\$2[aby]\$/); 
        });

        test("returns 500 when database query throws", async () => {
            user_queries.getUserIdAndToken.mockRejectedValueOnce(new Error("DB error"));

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
