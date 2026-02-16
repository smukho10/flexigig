const express = require("express");
const cors = require("cors");
const session = require("express-session");

const app = express();

app.use(express.json());

// CORS (keep it permissive for tests; your prod config can stay in server.js if you prefer)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Sessions (needed if any routes depend on req.session)
const isProd = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

if (isProd) {
  app.set("trust proxy", 1);
}
app.use(
  session({
    secret: process.env.SESSION_SECRET || "test_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax"
    }
  })
);


module.exports = app;