# Flexigig — API Keys & Secrets Setup Guide

This document walks new team members through obtaining, configuring, and verifying every third-party credential the project uses. Follow each section in order before running the app locally.

> **Security rule:** Never commit real secrets to the repository. The `.env` file lives in `backend/src/` and is (or must be) listed in `.gitignore`. Always share secrets through a secure channel (e.g., the team password manager or a private Slack DM), never in a PR or public chat.

---

## Table of Contents

1. [Environment file overview](#1-environment-file-overview)
2. [PostgreSQL (local & cloud)](#2-postgresql-local--cloud)
3. [Google OAuth 2.0](#3-google-oauth-20)
4. [SendGrid (email)](#4-sendgrid-email)
5. [Cloudflare R2 (file storage)](#5-cloudflare-r2-file-storage)
6. [Session secret](#6-session-secret)
7. [Frontend environment](#7-frontend-environment)
8. [Quick-start checklist](#8-quick-start-checklist)

---

## 1. Environment file overview

The backend reads all secrets from a single file:

```
backend/src/.env
```

Create this file (it is git-ignored) and populate it with the variables shown in each section below. A complete template is repeated at the end of this document.

```
backend/src/.env          ← backend secrets (never commit)
frontend/.env             ← frontend public variables (see §7)
```

---

## 2. PostgreSQL (local & cloud)

### Local development

Install PostgreSQL locally (version 14+ recommended). After installation:

1. Open **pgAdmin** or a `psql` shell.
2. Create a database and user:
   ```sql
   CREATE DATABASE flexygig;
   CREATE USER postgres WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE flexygig TO postgres;
   ```
3. Note the port — the default is `5432`; if something else is already on that port, PostgreSQL may bind to `5433`.

Add to `backend/src/.env`:

```env
PGHOST=localhost
PGPORT=5432          # change to 5433 if your local install uses that port
PGUSER=postgres
PGPASSWORD=your_local_password
PGDATABASE=flexygig
NODE_ENV=development
```

### Cloud database (Render / production)

The team uses [Render](https://render.com) to host the production PostgreSQL instance.

1. Log in to the Render dashboard → **PostgreSQL** → select the `flexigig_backend_posgres` service.
2. Click **Connect** → copy the values shown for **Host**, **Database**, **Username**, **Password**, and **Port**.
3. Replace the local block above with the cloud values and set `NODE_ENV=production`:

```env
PGHOST=<host>.oregon-postgres.render.com
PGPORT=5432
PGUSER=<db_username>
PGPASSWORD=<db_password>
PGDATABASE=<db_name>
NODE_ENV=production
```

> If Render requires SSL, add `PGSSLMODE=require` to the same block.

---

## 3. Google OAuth 2.0

The app uses Google OAuth for sign-in. Each developer can either reuse the shared project credentials (ask the team lead) or create their own for local testing.

### Getting credentials from Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com) and sign in with the team Google account (or your own for local dev).
2. Select the project **Flexigig** from the project dropdown (top-left). If it doesn't exist, create a new project.
3. Navigate to **APIs & Services → Credentials**.
4. Click **+ Create Credentials → OAuth client ID**.
5. Set the **Application type** to **Web application**.
6. Under **Authorised redirect URIs**, add:
   - `http://localhost:5000/api/auth/google/callback` (local dev)
   - `https://<your-production-domain>/api/auth/google/callback` (production)
7. Click **Create**. A dialog shows your **Client ID** and **Client Secret** — copy both immediately.

### OAuth consent screen (one-time setup)

If the consent screen has not been configured yet:

1. Go to **APIs & Services → OAuth consent screen**.
2. Set **User type** to **External** so any Google account can log in.
3. Fill in the required app name, support email, and developer contact.
4. Under **Publishing status**, click **Publish App**. Without this, users outside the test list receive a `403 access_denied` error.

### Environment variables

```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
FRONTEND_URL=http://localhost:3000   # or your deployed frontend URL
```

---

## 4. SendGrid (email)

The app sends transactional emails (e.g., verification, notifications) via [SendGrid](https://sendgrid.com).

### Creating an API key

1. Log in to the SendGrid dashboard.
2. Go to **Settings → API Keys → Create API Key**.
3. Give it a descriptive name (e.g., `flexigig-dev`).
4. Select **Restricted Access** and enable at minimum:
   - **Mail Send → Full Access**
5. Click **Create & View** — copy the key now, it is shown only once.

### Sender verification

SendGrid will block or spam-folder outbound mail unless the sender address is verified.

- **Single Sender Verification** (quickest for dev): Go to **Settings → Sender Authentication → Single Sender Verification** and verify the specific `From` email address. This works for any non-Gmail address.
- **Domain Authentication** (recommended for production): Go to **Settings → Sender Authentication → Authenticate Your Domain** and follow the DNS record instructions for the domain used in `EMAIL_FROM`.

> Gmail addresses (`@gmail.com`) **cannot** be used as sender addresses on SendGrid's shared IP pools. Use the team's domain address instead.

### Environment variables

```env
SENDGRID_API_KEY=SG.your_sendgrid_api_key
EMAIL_FROM=Flexigig <hello@yourdomain.com>
```

---

## 5. Cloudflare R2 (file storage)

Profile pictures and other uploads are stored in a [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket.

### Getting R2 credentials

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) with the team account.
2. Select the correct account from the account switcher (top-left).
3. In the left sidebar, go to **R2 Object Storage**.
4. **Bucket name**: click on the `flexigig-profile-pics` bucket. The name shown is `R2_BUCKET`.
5. **Endpoint**: still on the bucket overview page, the S3-compatible endpoint is shown as:
   ```
   https://<account_id>.r2.cloudflarestorage.com
   ```
   Copy this as `R2_ENDPOINT`.
6. **Access keys**: go back to the R2 overview page → click **Manage R2 API Tokens** (top-right).
7. Click **Create API Token**.
   - Permissions: **Object Read & Write**
   - Scope: **Specific bucket** → `flexigig-profile-pics`
8. Click **Create API Token** — copy the **Access Key ID** and **Secret Access Key** immediately (the secret is shown only once).

### Environment variables

```env
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=flexigig-profile-pics
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_SIGNED_URL_EXPIRY=3600
```

`R2_SIGNED_URL_EXPIRY` controls how long (in seconds) a pre-signed download URL remains valid. `3600` = 1 hour.

---

## 6. Session secret

The backend uses a session secret to sign cookies. Generate a strong random value — never use a short or guessable string.

**Generate one on macOS/Linux:**
```bash
openssl rand -hex 32
```

**Generate one on Windows (PowerShell):**
```powershell
[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace("-","").ToLower()
```

Add to `backend/src/.env`:

```env
SESSION_SECRET=your_64_char_hex_string
```

Each developer should use a unique value locally. The production value is managed by the team lead and stored in the deployment platform's environment variables (not in the repo).

---

## 7. Frontend environment

The React frontend uses `REACT_APP_*` variables (Create React App convention).

Create `frontend/.env` (also git-ignored):

```env
REACT_APP_BACKEND_URL=http://localhost:5000
```

For production builds, set this to the deployed backend URL before running `npm run build`.

---

## 8. Quick-start checklist

Use this list to confirm your environment is ready before running the app.

- [ ] `backend/src/.env` exists and is **not** staged in git (`git status` should not show it)
- [ ] PostgreSQL is running and the `flexygig` database exists
- [ ] `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` are set correctly
- [ ] Google OAuth credentials obtained and redirect URIs include your local callback URL
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- [ ] `FRONTEND_URL` matches where the frontend is served (e.g., `http://localhost:3000`)
- [ ] SendGrid API key created and sender address verified
- [ ] `SENDGRID_API_KEY` and `EMAIL_FROM` are set
- [ ] Cloudflare R2 API token created with read/write access to the bucket
- [ ] `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` are set
- [ ] `SESSION_SECRET` is set to a randomly generated 64-character hex value
- [ ] `frontend/.env` exists with `REACT_APP_BACKEND_URL` pointing to the backend

---

## Complete `.env` template

Copy this into `backend/src/.env` and fill in each value:

```env
# ── Node ──────────────────────────────────────────────────
NODE_ENV=development

# ── PostgreSQL (local) ────────────────────────────────────
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=
PGDATABASE=flexygig

# ── PostgreSQL (cloud — uncomment for production) ─────────
# PGHOST=
# PGPORT=5432
# PGUSER=
# PGPASSWORD=
# PGDATABASE=
# NODE_ENV=production
# PGSSLMODE=require

# ── Google OAuth ──────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FRONTEND_URL=http://localhost:3000

# ── SendGrid ──────────────────────────────────────────────
SENDGRID_API_KEY=
EMAIL_FROM=Flexigig <hello@yourdomain.com>

# ── Cloudflare R2 ─────────────────────────────────────────
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=flexigig-profile-pics
R2_ENDPOINT=
R2_SIGNED_URL_EXPIRY=3600

# ── Session ───────────────────────────────────────────────
SESSION_SECRET=

# ── External services ─────────────────────────────────────
NOMINATIM_URL=https://nominatim.openstreetmap.org/search
```
