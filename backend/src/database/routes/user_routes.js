const express = require("express");
const db = require("../connection.js");
const router = express.Router();
const user_queries = require("../queries/user_queries.js");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const workers_queries = require("../queries/workers_queries.js");
require("dotenv").config();

/**
 * REGISTER
 */
router.post("/register", async (req, res) => {
  const {
    email,
    password,
    accountType,
    phone_number,
    photo,
    firstName,
    lastName,
    businessName,
    businessDescription,
  } = req.body;

  console.log("Incoming registration data:", req.body);

  if (!email || !password || !accountType) {
    res.status(400).send("Invlaid credentials");
    return;
  }

  try {
    const foundUser = await user_queries.getUserByEmail(email);
    if (foundUser) {
      res.status(400).send("Email is already exists");
      return;
    }

    // turn accountType to boolean isBusiness
    let isBusiness = "";
    if (accountType === "Worker") isBusiness = "false";
    else if (accountType === "Employer") isBusiness = "true";

    // add user into database
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await user_queries.addUser(
      email,
      hashedPassword,
      isBusiness,
      phone_number,
      photo
    );

    console.log("User added:", user);

    if (accountType === "Worker") {
      await user_queries.addWorker(user.id, firstName, lastName);
    } else if (accountType === "Employer") {
      await user_queries.addBusiness(user.id, businessName, businessDescription);
    }

    // generate + save verification token
    const verificationToken = crypto.randomBytes(64).toString("hex");
    await user_queries.saveVerificationToken(user.id, verificationToken);

    const updatedUser = await user_queries.getUserById(user.id);
    res.status(200).json({
      message: "User registered successfully...",
      user: updatedUser,
    });

    // send verification email
    await sendVerificationEmail(email, verificationToken);
  } catch (error) {
    console.error("Error during user registration;");
    res.status(500).send("Internal Server Error");
  }
});

async function sendVerificationEmail(email, token) {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
      },
    });

    const frontendURL = process.env.FRONTEND_URL;

    const mailOptions = {
      to: email,
      subject: "Flexygig - Verify Your Email Address",
      html: `
        <p>Click the link below to verify your email:</p>
        <a href="${frontendURL}/verify/${token}">Verify Email</a>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending verification email:", error);
  }
}

/**
 * VERIFY PENDING USER (email link)
 */
router.get("/verify/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM pending_users WHERE token = $1;`,
      [token]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const pending = result.rows[0];

    const existingUser = await user_queries.getUserByEmail(pending.email);
    if (existingUser) {
      await db.query(`DELETE FROM pending_users WHERE token = $1;`, [token]); // cleanup
      return res.status(400).json({ message: "User already verified" });
    }

    const locationResult = await db.query(
      `
      INSERT INTO locations (StreetAddress, city, province, postalCode)
      VALUES ($1, $2, $3, $4)
      RETURNING location_id;
      `,
      [pending.street_address, pending.city, pending.province, pending.postal_code]
    );

    const locationId = locationResult.rows[0].location_id;

    const user = await user_queries.addUser(
      pending.email,
      pending.password,
      pending.account_type === "Employer",
      pending.phone_number,
      pending.photo,
      locationId
    );

    if (pending.account_type === "Worker") {
      const worker = await user_queries.addWorker(
        user.id,
        pending.first_name,
        pending.last_name
      );

      const skills =
        typeof pending.skills === "string"
          ? JSON.parse(pending.skills)
          : pending.skills;
      for (const skill of skills) {
        await workers_queries.addWorkerSkill(worker.id, skill.skill_id);
      }

      const experiences =
        typeof pending.experiences === "string"
          ? JSON.parse(pending.experiences)
          : pending.experiences;
      for (const experience of experiences) {
        await workers_queries.addWorkerExperience(
          worker.id,
          experience.experience_id
        );
      }

      const traits =
        typeof pending.traits === "string"
          ? JSON.parse(pending.traits)
          : pending.traits;
      for (const trait of traits) {
        await workers_queries.addWorkerTrait(worker.id, trait.trait_id);
      }
    } else {
      await user_queries.addBusiness(
        user.id,
        pending.business_name,
        pending.business_description || ""
      );
    }

    await db.query(`DELETE FROM pending_users WHERE token = $1;`, [token]);

    //Optional auto-login after verification with single-device lock
    req.session.regenerate(async (err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }

      req.session.user_id = user.id;

      // Atomic lock: only set if no active session
      const update = await db.query(
        `
        UPDATE users
        SET current_session_id = $1,
            session_last_seen = NOW()
        WHERE id = $2
          AND current_session_id IS NULL
        RETURNING id;
        `,
        [req.sessionID, user.id]
      );

      if (update.rowCount === 0) {
        req.session.destroy(() => {});
        return res.status(409).json({
          message:
            "This account is already logged in on another device. Please log out there first.",
        });
      }

      return res.status(200).json(user);
    });
  } catch (error) {
    console.error("Error verifying pending user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * TOKEN VALIDATION
 */
router.get("/validate-token/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const valid = await user_queries.validateToken(token);
    res.status(200).send(valid ? "valid" : "invalid");
  } catch (error) {
    console.error("Error validating token:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * RESEND VERIFICATION
 */
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await user_queries.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const token = crypto.randomBytes(64).toString("hex");
    await user_queries.insertOrUpdateToken(user.id, token);

    await sendVerificationEmail(email, token);

    return res
      .status(200)
      .json({ success: true, message: "Verification email sent successfully." });
  } catch (error) {
    console.error("Error resending verification email:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * PENDING REGISTER
 */
router.post("/pending-register", async (req, res) => {
  const {
    email,
    password,
    accountType,
    firstName,
    lastName,
    businessName,
    businessDescription,
    phone_number,
    photo,
    street_address,
    city,
    province,
    postal_code,
    skills,
    experiences,
    traits,
  } = req.body;

  if (!email || !password || !accountType) {
    res.status(400).json({ message: "Missing required fields" });
    return;
  }

  try {
    const existingUser = await user_queries.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const pendingResult = await db.query(
      "SELECT * FROM pending_users WHERE email = $1;",
      [email]
    );
    if (pendingResult.rows.length > 0) {
      return res.status(400).json({
        message: "A user with this email is already pending verification.",
      });
    }

    const token = crypto.randomBytes(64).toString("hex");
    const hashedPassword = bcrypt.hashSync(password, 10);

    await db.query(
      `
      INSERT INTO pending_users
        (email, password, account_type, first_name, last_name, business_name, business_description, phone_number, photo, token, street_address, city, province, postal_code, skills, experiences, traits)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `,
      [
        email,
        hashedPassword,
        accountType,
        firstName,
        lastName,
        businessName,
        businessDescription,
        phone_number,
        photo,
        token,
        street_address,
        city,
        province,
        postal_code,
        JSON.stringify(skills),
        JSON.stringify(experiences),
        JSON.stringify(traits),
      ]
    );

    await sendVerificationEmail(email, token);

    res
      .status(200)
      .json({ message: "Please check your email to complete registration." });
  } catch (error) {
    console.error("Error creating pending user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * LOGIN: one-device-at-a-time (RACE-SAFE)
 * Uses an atomic UPDATE that only succeeds if current_session_id IS NULL.
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  try {
    const foundUser = await user_queries.checkLoginCredentials(email, password);
    if (!foundUser) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const userId = foundUser.id;

    //Always create a fresh session ID for the login
    req.session.regenerate(async (err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }

      req.session.user_id = userId;

      //Atomic lock: only set session if there is no active session
      const update = await db.query(
        `
        UPDATE users
        SET current_session_id = $1,
            session_last_seen = NOW()
        WHERE id = $2
          AND current_session_id IS NULL
        RETURNING id;
        `,
        [req.sessionID, userId]
      );

      // If 0 rows updated => already logged in elsewhere
      if (update.rowCount === 0) {
        req.session.destroy(() => {});
        return res.status(409).json({
          message:
            "This account is already logged in on another device. Please log out there first.",
        });
      }

      return res.status(200).json(foundUser);
    });
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * validate current session matches users.current_session_id
 */
router.get("/me", async (req, res) => {
  try {
    if (!req.session || !req.session.user_id) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const userId = req.session.user_id;

    const result = await db.query(
      "SELECT current_session_id FROM users WHERE id = $1",
      [userId]
    );

    const currentSessionId = result.rows[0]?.current_session_id;

    if (!currentSessionId || currentSessionId !== req.sessionID) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Not logged in" });
    }

    await db.query("UPDATE users SET session_last_seen = NOW() WHERE id = $1", [
      userId,
    ]);

    const user = await user_queries.getUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.status(200).json(user);
  } catch (err) {
    console.error("Error in /api/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 *LOGOUT: clear lock so user can login elsewhere
 */
router.post("/logout", async (req, res) => {
  try {
    const userId = req.session?.user_id;

    if (userId) {
      await db.query(
        "UPDATE users SET current_session_id = NULL, session_last_seen = NULL WHERE id = $1",
        [userId]
      );
    }

    req.session.destroy(() => {
      res.status(200).send();
    });
  } catch (err) {
    console.error("Error during logout:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ---- the rest of your existing routes stay the same ----

// Get conversation partners for a user
router.get("/conversation-partners/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const partners = await user_queries.getConversationPartners(userId);
    res.status(200).json({ success: true, partners });
  } catch (error) {
    console.error("Error fetching conversation partners:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Get message history between two users
router.get("/message-history", async (req, res) => {
  const { senderId, receiverId } = req.query;

  if (!senderId || !receiverId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing senderId or receiverId" });
  }

  try {
    const messages = await user_queries.getMessageHistory(senderId, receiverId);
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching message history:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Send a message to another user
router.post("/send-message", async (req, res) => {
  const { senderId, receiverId, content } = req.body;

  if (!senderId || !receiverId || !content) {
    return res.status(400).json({
      success: false,
      message: "Missing senderId, receiverId, or content",
    });
  }

  try {
    const message = await user_queries.sendMessage(senderId, receiverId, content);
    res.status(200).json({ success: true, message });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Get the latest messages for a user
router.get("/latest-messages/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const messages = await user_queries.getLatestMessages(userId);

    if (messages.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No messages found" });
    }

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching latest messages:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Search feature
router.get("/search-users", async (req, res) => {
  const { query } = req.query;

  try {
    const values = [];
    let whereClause = "";

    if (query) {
      values.push(`%${query}%`);
      whereClause = `
        WHERE
          (w.first_name ILIKE $1 OR
           w.last_name ILIKE $1 OR
           b.business_name ILIKE $1)
      `;
    }

    const searchQuery = `
      SELECT
        u.id,
        u.isbusiness,
        u.userimage AS "userImage",
        u.user_phone_number AS phone_number,
        u.email,
        l.city,
        l.province,
        w.first_name,
        w.last_name,
        COALESCE(array_agg(DISTINCT s.skill_name) FILTER (WHERE s.skill_name IS NOT NULL), '{}') AS skills,
        COALESCE(array_agg(DISTINCT t.trait_name) FILTER (WHERE t.trait_name IS NOT NULL), '{}') AS traits,
        COALESCE(array_agg(DISTINCT e.experience_name) FILTER (WHERE e.experience_name IS NOT NULL), '{}') AS experiences,
        b.business_name,
        b.business_description
      FROM users u
      JOIN locations l ON u.user_address = l.location_id
      LEFT JOIN workers w ON u.id = w.user_id
      LEFT JOIN businesses b ON u.id = b.user_id
      LEFT JOIN workers_skills ws ON w.id = ws.workers_id
      LEFT JOIN skills s ON ws.skill_id = s.skill_id
      LEFT JOIN workers_traits wt ON w.id = wt.workers_id
      LEFT JOIN traits t ON wt.trait_id = t.trait_id
      LEFT JOIN workers_experiences we ON w.id = we.workers_id
      LEFT JOIN experiences e ON we.experience_id = e.experience_id
      ${whereClause}
      GROUP BY u.id, l.city, l.province, w.id, b.id;
    `;

    const { rows } = await db.query(searchQuery, values);
    res.json(rows);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).send("Server error");
  }
});

// Get user details (worker first/last name or business name)
router.get("/user-details/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const userDetails = await user_queries.getUserDetails(userId);

    if (userDetails.type === "unknown") {
      return res
        .status(404)
        .json({ success: false, message: userDetails.message });
    }

    res.status(200).json({ success: true, userDetails });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
