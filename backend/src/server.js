require('dotenv').config({ path: __dirname + '/.env' }); // Load from src/.env
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const app = require("./app");
const passport = require('./config/passport.js');

const PORT = process.env.PORT || 5000;

/**
 * CORS
 * - Allow localhost dev
 * - Allow your custom domains
 * - Allow Vercel deployments (*.vercel.app)
 */
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://flexygig.co',
  'https://www.flexygig.co',
  'https://flexygig-nine.vercel.app'
];

function isAllowedOrigin(origin) {
  if (!origin) return true; // allow curl / server-to-server requests
  const normalized = origin.replace(/\/$/, '');

  return (
    allowedOrigins.includes(normalized) ||
    normalized.endsWith('.vercel.app')
  );
}

app.use(cors({
  origin: function (origin, callback) {
    const normalizedOrigin = origin ? origin.replace(/\/$/, '') : origin;

    if (isAllowedOrigin(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.error(`CORS error: Origin ${normalizedOrigin} is not allowed.`);
      callback(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
    }
  },
  credentials: true
}));

// middleware set up to parse the JSON body
app.use(express.json());

/**
 * Sessions
 * IMPORTANT for Vercel(frontend) -> Render(backend) cross-site cookies:
 * - sameSite must be 'none'
 * - secure must be true in production (required by browsers when sameSite='none')
 * - trust proxy must be enabled on Render so secure cookies work correctly behind proxy
 */
app.set('trust proxy', 1);

const sessionSecret = process.env.SESSION_SECRET || 'default-secret-key';
if (sessionSecret === 'default-secret-key') {
  console.warn("Warning: SESSION_SECRET is not set. Using a default secret. This is insecure for production.");
}

const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,                 // true on Render (https)
    sameSite: isProd ? 'none' : 'lax', // 'none' for cross-site cookies in prod
    maxAge: 24 * 60 * 60 * 1000     // 1 day
  }
}));

// Initialize Passport (must be after session middleware)
app.use(passport.initialize());
app.use(passport.session());

//Single-session enforcement middleware
const enforceSingleSession = require('./database/middleware/enforce_single_session.js');

const userRouter = require('./database/routes/user_routes.js');
const authRouter = require('./database/routes/auth_routes.js');
const profileRouter = require('./database/routes/profile_routes.js');
const jobRouter = require('./database/routes/job_routes.js');
const workersRouter = require('./database/routes/workers_routes.js');
const calendar = require('./database/routes/calendar-routes.js');
const businessRoutes = require('./database/routes/business_routes.js');

const fs = require('fs');
app.use(express.static('public'));

const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
  console.log("Created missing 'uploads/' folder.");
}

// image set to store profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    console.error("No file received.");
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log("File received:", req.file);
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply enforcement BEFORE routers (only on /api)
app.use('/api', enforceSingleSession);

app.use('/api', userRouter);
app.use('/api', authRouter);
app.use('/api', profileRouter);
app.use('/api', jobRouter);
app.use('/api', calendar);
app.use('/api', workersRouter);
app.use('/api', businessRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}!!!`);
});
