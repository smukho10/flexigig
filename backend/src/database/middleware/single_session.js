const user_queries = require("../queries/user_queries.js");

const SKIP_PREFIXES = [
  "/login",
  "/register",
  "/pending-register",
  "/verify",
  "/initiate-password-reset",
  "/reset-password",
  "/auth/google",
];

function shouldSkip(path) {
  return SKIP_PREFIXES.some((p) => path.startsWith(p));
}

module.exports = async function enforceSingleSession(req, res, next) {
  try {
    if (shouldSkip(req.path)) return next();

    // Not logged in -> let route handle it (many routes already return 401)
    if (!req.session || !req.session.user_id) return next();

    const userId = req.session.user_id;
    const activeSessionId = await user_queries.getCurrentSessionId(userId);

    // If DB session doesn't exist or doesn't match, reject.
    if (!activeSessionId || activeSessionId !== req.sessionID) {
      req.session.destroy(() => {});

      const isProd = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
      res.clearCookie("connect.sid", {
        path: "/",
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
      });

      return res.status(401).json({
        error: "Session invalidated: you logged in on another device.",
      });
    }

    // Optional: update last_seen at most once per minute
    const now = Date.now();
    const lastTouch = req.session._lastSessionTouch || 0;
    if (now - lastTouch > 60_000) {
      req.session._lastSessionTouch = now;
      user_queries.touchSessionLastSeen(userId).catch(() => {});
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
