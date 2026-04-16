# Technical Documentation: Setup & Code Deployment

---

## 1. Project Structure

```
flexigig/
├── frontend/                  # React application
│   ├── src/
│   │   ├── components/        # All React components (pages + reusable)
│   │   ├── styles/            # CSS stylesheets
│   │   ├── assets/            # Images, icons, static files
│   │   └── test/              # Frontend test files
│   ├── package.json           # Frontend dependencies
│   └── vercel.json            # Vercel deployment configuration
│
├── backend/                   # Express.js server
│   ├── src/
│   │   ├── server.js          # Application entry point
│   │   ├── app.js             # Express app and middleware setup
│   │   ├── config/            # Passport and R2 storage config
│   │   ├── database/
│   │   │   ├── connection.js  # PostgreSQL connection
│   │   │   ├── queries/       # SQL query functions (data layer)
│   │   │   ├── routes/        # API route handlers (controller layer)
│   │   │   └── seeds/         # Database seed SQL files
│   │   └── services/          # Background services (notifications, geocoding)
│   ├── package.json           # Backend dependencies
│   └── .env                   # Environment variables (not committed to repo)
│
└── README.md
```

---

## 2. Prerequisites

- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- **Git**
- **PostgreSQL** (if running database locally, otherwise cloud DB access)

---

## 3. Local Development Setup

### 3.1 Clone the Repository

```bash
git clone https://github.com/smukho10/flexigig.git
cd flexigig
```

### 3.2 Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory. Refer to the **Environment Variable Reference** section below for the full list of required variables. Obtain the actual values from the team lead or project admin.

Start the backend:

```bash
npm start
```

### 3.3 Frontend Setup

```bash
cd frontend
npm install
```

Start the frontend:

```bash
npm start
```

The frontend proxies API requests to the backend automatically via the `proxy` field in `frontend/package.json`.

### 3.4 Database Seeding (Fresh Setup Only)

If starting with an empty database, run the seed files against your PostgreSQL instance in order:

1. `backend/src/database/seeds/001_seeds.sql` — Creates initial data (locations, users, workers, businesses, jobs)
2. `backend/src/database/seeds/002_seeds.sql` — Additional seed data

---

## 4. Build Process

### Frontend Build

```bash
cd frontend
npm run build
```

This creates an optimized production build in `frontend/build/`. This is the output that gets deployed to the hosting platform.

### Backend

No build step required — the backend runs directly with Node.js (`node ./src/server.js`).

---

## 5. Testing

### Backend Tests

```bash
cd backend
npm test                  # Run all tests
npm run test:watch        # Run in watch mode
npm run test:coverage     # Run with coverage report
```

- Framework: Jest + Supertest
- Test files located in: `backend/test/routes/`
- Tests run with `NODE_ENV=test`

### Frontend Tests

```bash
cd frontend
npm test                  # Run all tests
npm run test:coverage     # Run with coverage report
```

- Framework: Jest + React Testing Library
- Test files located in: `frontend/src/test/`

---

## 6. Deployment Architecture

```
                    ┌──────────────────┐
   Users ───────►  │  Vercel (CDN)    │   ── frontend
                    │  flexygig.co     │
                    └────────┬─────────┘
                             │ /api/* requests proxied
                             ▼
                    ┌──────────────────┐
                    │  Render          │   ── backend
                    │  Node.js service │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Render          │   ── database
                    │  Managed Postgres│
                    └──────────────────┘
```

### 6.1 Frontend Deployment (Vercel)

- Deploys automatically on every Git push to the connected branch
- Configuration defined in `frontend/vercel.json`
- API proxy rule: all `/api/*` requests are rewritten to the Render backend URL
- Production URL: **https://flexygig.co**

No manual deployment steps needed — pushing code to the repository triggers automatic deployment.

### 6.2 Backend Deployment (Render)

- Deployed as a Node.js service on Render
- Render detects `npm start` from `package.json` and runs `node ./src/server.js`
- Environment variables are configured in the Render dashboard (not in code)
- SSL is handled by Render — the app enables `trust proxy` for secure cookies behind the reverse proxy

### 6.3 Database (Render Managed PostgreSQL)

- Hosted on Render as a managed PostgreSQL instance
- Connection requires SSL (`PGSSLMODE=require`)
- The `connection.js` file automatically enables SSL when `NODE_ENV=production` or `PGSSLMODE=require` is set

---

## 7. CORS Configuration

The backend restricts which origins can make API requests. Configured in `backend/src/server.js` via the `allowedOrigins` array.

Currently allowed origins include:

- Local development origins (frontend and backend ports)
- Production domains (`flexygig.co`, `www.flexygig.co`)
- Vercel deployment and preview URLs

If a new domain is added for the frontend, it must be added to the `allowedOrigins` array in `server.js`.

---

## 8. Environment Variable Reference

The following environment variables are required in the backend `.env` file. Obtain actual values from the team lead or project admin.

| Variable | Purpose |
|----------|---------|
| `PGHOST` | PostgreSQL host address |
| `PGUSER` | PostgreSQL username |
| `PGDATABASE` | PostgreSQL database name |
| `PGPASSWORD` | PostgreSQL password |
| `PGPORT` | PostgreSQL port (default: 5432) |
| `PGSSLMODE` | Set to `require` for cloud-hosted DB |
| `PORT` | Backend server port |
| `NODE_ENV` | `development` or `production` |
| `SESSION_SECRET` | Secret key for session encryption |
| `SENDGRID_API_KEY` | SendGrid email API key |
| `EMAIL_FROM` | Sender email address for notifications |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `R2_ENDPOINT` | Cloudflare R2 endpoint URL |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_BUCKET` | Cloudflare R2 bucket name |
| `R2_SIGNED_URL_EXPIRY` | Signed URL expiry in seconds (default: 3600) |

> **Important:** Never commit the `.env` file to the repository. It contains sensitive credentials.

---

## 9. Switching Between Local and Cloud Database

In `backend/.env`, toggle between local and cloud PostgreSQL by commenting/uncommenting the relevant block:

```env
# Cloud Database (Render)
PGHOST=<cloud-postgres-host>
PGUSER=<cloud-user>
PGDATABASE=<cloud-database>
PGPASSWORD=<cloud-password>
PGSSLMODE=require

# Local Database (uncomment to use)
# PGHOST=localhost
# PGDATABASE=<local-database-name>
# PGUSER=postgres
# PGPASSWORD=postgres
# PGPORT=5432
```

When using local PostgreSQL, remove or comment out `PGSSLMODE=require`.

---

## 10. Git Workflow

- The main branch is `main`
- Feature branches follow the naming convention: `US<story>-Task-<number>-<short-description>`
  - Example: `US24-Task-1-Add-messaging-feature-on-worker-board`
- Create a pull request from your feature branch to `main`
- PRs require approval before merging
- After merging, Vercel and Render auto-deploy from `main`

---

## 11. Common Issues and Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Cannot find module 'xyz'` | Missing dependency after pulling new code | Run `npm install` in the affected directory (frontend or backend) |
| `Invalid credentials` on login | CORS blocking requests from frontend | Ensure the frontend origin is listed in `allowedOrigins` in `server.js` |
| Backend connects but queries fail | SSL misconfigured for database | Set `PGSSLMODE=require` for cloud DB, remove it for local DB |
| Frontend API calls return 500 | Backend not running or wrong proxy target | Ensure backend is running on the port specified in `frontend/package.json` proxy field |
| `ECONNREFUSED` on frontend | Backend server not started | Run `npm start` in the `backend/` directory first |
| Profile photos not loading | R2 environment variables missing or expired signed URLs | Verify R2 credentials in `.env` and check `R2_SIGNED_URL_EXPIRY` |
