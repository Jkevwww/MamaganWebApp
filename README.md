# Mamagan Web Application (Facility Booking)

A facility booking and management system built with **Node.js + Express** and **MySQL**. It supports local authentication (email/password) and OAuth (Google; GitHub documented for future wiring).

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js + Express
- **Auth:** JWT (app auth) + Passport OAuth (session for OAuth state)
- **Database:** MySQL (Aiven cloud)
- **Deployment:** Render

---

## Local Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
Copy and edit the template:
```bash
cp .env.example .env
```
Then fill in:
- `MYSQL_*` (Aiven MySQL credentials)
- `MYSQL_SSL_CA` (see next section)
- `JWT_SECRET`
- `SESSION_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

> Note: The runtime `PORT` defaults to `3000` when running locally. For Render compatibility, use `PORT=10000`.

---

## Aiven MySQL Setup (SSL)

This project supports MySQL over SSL using `MYSQL_SSL_CA`.

### How to set `MYSQL_SSL_CA`
Aiven provides a CA certificate. Put it into your env var in one of these formats:

**Option A (common): keep `\n` line breaks in the env var**
```env
MYSQL_SSL_CA=-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----
```

**Option B: paste the literal PEM with actual newlines**
```env
MYSQL_SSL_CA=-----BEGIN CERTIFICATE-----
MIID...
-----END CERTIFICATE-----
```

The server code converts `\\n` into real newlines automatically.

---

## Database Migrations and Seeding

### Run migrations
```bash
npm run db:migrate
```

### Seed database
```bash
npm run db:seed
```

---

## Run Locally

### Development (auto-reload)
```bash
npm run dev
```

### Production mode (no auto-reload)
```bash
npm start
```

---

## Environment Variables

At minimum, set these in `.env` (and in Render):

- **Node/Server**
  - `NODE_ENV`
  - `PORT`
  - `SERVER_URL`
  - `CLIENT_URL`

- **Auth**
  - `JWT_SECRET`
  - `SESSION_SECRET`

- **MySQL (Aiven)**
  - `MYSQL_HOST`
  - `MYSQL_PORT`
  - `MYSQL_USER`
  - `MYSQL_PASSWORD`
  - `MYSQL_DATABASE`
  - `MYSQL_SSL_CA`

- **Admin bootstrap**
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`

- **Google OAuth**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL`
  - `OAUTH_SUCCESS_GUEST_REDIRECT`
  - `OAUTH_SUCCESS_ADMIN_REDIRECT`
  - `OAUTH_FAILURE_REDIRECT`

- **GitHub OAuth (documentation only unless code is added)**
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_CALLBACK_URL`

---

## Default Admin Account

The system can create/recognize a default admin account using environment variables:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

---

## Local Email/Password Auth

End points:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout` (front-end logout flow)

---

## Google OAuth Setup

### 1) Create OAuth credentials
- Google Cloud Console → **APIs & Services** → **Credentials**
- Create OAuth **Client ID** (Web application)

### 2) Configure callback URL
Set the authorized redirect URI(s) to match your environment.

For Render, use:
- `https://YOUR-RENDER-APP.onrender.com/api/auth/google/callback`

(For local testing you can use your local base URL.)

### 3) Configure env vars
Set:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

---

## GitHub OAuth Setup

This repository documents GitHub OAuth environment variables and redirect URLs:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`

> If GitHub OAuth routes/strategy are not present in the backend, requests to `/api/auth/github/...` will not work until GitHub OAuth is implemented.

---

## Render Deployment Setup (Render Compatibility)

### Required Render runtime settings
This app is compatible with Render when the following are set:

- `NODE_ENV=production`
- `PORT=10000`
- MySQL `MYSQL_*` variables
- `MYSQL_SSL_CA`
- `JWT_SECRET` and `SESSION_SECRET`
- OAuth variables for Google (and optionally GitHub)

### Where redirects point
Set:
- `SERVER_URL=https://YOUR-RENDER-APP.onrender.com`
- `CLIENT_URL=https://YOUR-RENDER-APP.onrender.com`

OAuth redirect paths:
- `OAUTH_SUCCESS_GUEST_REDIRECT=/facilities.html`
- `OAUTH_SUCCESS_ADMIN_REDIRECT=/admin/dashboard.html`
- `OAUTH_FAILURE_REDIRECT=/login.html?error=oauth_failed`

---

## Testing Checklist (Final)

Use this checklist to validate behavior end-to-end.

### Auth: Local
- [ ] Local email/password register works (`/api/auth/register`)
- [ ] Local email/password login works (`/api/auth/login`)
- [ ] `/api/auth/me` returns current user after login
- [ ] Logout clears auth state

### Auth: Account status
- [ ] Disabled user login is blocked (inactive users cannot authenticate)

### Auth: Google OAuth
- [ ] Google OAuth login completes successfully
- [ ] Existing admin Google account logs in as admin (admin route access)
- [ ] New OAuth user becomes `GUEST`

### Auth: GitHub OAuth
- [ ] GitHub OAuth login completes successfully **if backend is implemented**

### Routes / Security
- [ ] Direct frontend page visits work (static `public/*.html` served correctly)
- [ ] Admin route protection works (non-admin cannot access `/api/admin/*`)
- [ ] `/api/auth/me` returns 401/unauthorized when not authenticated

### Database / Deployment
- [ ] Aiven MySQL connection succeeds with `MYSQL_SSL_CA`
- [ ] Render environment variables are present and correct

---

## Notes / Warnings

- GitHub OAuth is documented in this repo; ensure backend routes/strategy exist before enabling GitHub.
- For production OAuth cookies, `SESSION_SECRET` must be set, and `NODE_ENV=production` should be used.

