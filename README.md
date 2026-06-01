# Mamagan Fun & Adventure Beach Resort — Online Booking & Payment (GCash via PayMongo)

Resort guests can register, sign in (email/password or OAuth), browse facilities, book, pay through PayMongo (GCash and other methods), and receive QR tickets. Staff use an admin panel for facilities, bookings, rates, calendar, check-in, and reports.

**Stack:** Node.js + Express, MySQL (mysql2/promise, Aiven-ready SSL), plain HTML/CSS/vanilla JS frontend, deployment on **Render**.

---

## Repository layout

| Area | Location |
|------|----------|
| Express entry | `server.js` |
| Backend (routes, controllers, services, middleware, config, utils) | `src/` |
| Static site (guest + admin HTML/CSS/JS) | `public/` |
| SQL migrations + runner + seed | `database/` |
| Diagrams | `docs/` |

---

## Local setup

### 1) Install

```bash
npm install
```

### 2) Environment

Copy the template and fill in values (never commit `.env`):

```bash
cp .env.example .env
```

Important variables:

- **Server:** `NODE_ENV`, `PORT` (default in code is `10000` if unset), `SERVER_URL`, `CLIENT_URL`
- **Auth:** `JWT_SECRET`, `SESSION_SECRET` (session store is used for OAuth state only; app auth is JWT in an HTTP-only cookie)
- **MySQL:** `MYSQL_*`, `MYSQL_SSL_CA` for Aiven
- **Admin bootstrap:** `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE`
- **OAuth:** Google and GitHub client IDs/secrets and callback URLs (see below)
- **Redirects:** `OAUTH_SUCCESS_*`, `OAUTH_FAILURE_REDIRECT` (must be **relative paths** starting with `/` to avoid open redirects)
- **PayMongo:** `PAYMONGO_*`, `MOCK_PAYMENTS` for local testing

### 3) Database

```bash
npm run db:migrate
npm run db:seed
```

Migrations are additive where possible; new OAuth and logging columns use `CREATE TABLE IF NOT EXISTS` / conditional `ALTER` patterns. Review `database/migrations/` if you maintain a long-lived production database.

Facility images can be set with an external Image URL or uploaded locally from the admin Manage Facilities page. Local uploads are stored in `public/uploads/facilities`; on Render these files only persist across deploys/restarts when a persistent disk is configured, so Image URL is the recommended production option.

To create or repair only the default admin account after setting the `ADMIN_*` variables:

```bash
npm run create-admin
```

### 4) Run

```bash
npm run dev
```

Production-style:

```bash
npm start
```

Default local URL when `PORT=10000`: `http://localhost:10000`

### 5) Docker

The repository includes a production Docker image and a Docker Compose setup with MySQL.

Docker runtime values are loaded from `.env`. Keep that file private because it contains real credentials and is ignored by Git.

If you want to create a fresh private env file later, copy the sanitized template and fill in values:

```bash
cp .env.example .env
```

For local Docker, these values are enough to use the bundled MySQL container:

```env
NODE_ENV=production
PORT=10000
SERVER_URL=http://localhost:10000
CLIENT_URL=http://localhost:10000
JWT_SECRET=replace-this-with-a-long-random-value
SESSION_SECRET=replace-this-with-a-long-random-value
MYSQL_HOST=db
MYSQL_PORT=3306
MYSQL_USER=mamagan
MYSQL_PASSWORD=mamagan_password
MYSQL_DATABASE=mamagan
```

Build and start the app plus MySQL:

```bash
docker compose --env-file .env up --build -d
```

Run database migrations and seed data:

```bash
docker compose --env-file .env --profile tools run --rm migrate
docker compose --env-file .env --profile tools run --rm seed
```

Open `http://localhost:10000`.

Useful Docker commands:

```bash
docker compose logs -f app
docker compose down
docker compose down -v
```

`docker compose down -v` removes the MySQL and upload volumes, so only use it when you intentionally want to delete local Docker data.

---

## Authentication

### Unified login

Use `/login.html` for both tourists and admins. There is no separate admin login flow. After login, the app checks `role` and `access_tier`:

- `SUPER_ADMIN`, `ADMIN`, `STAFF`, and `VIEWER` go to `/admin/dashboard.html`.
- `GUEST` goes to `/facilities.html`.
- `/admin/login.html` redirects to `/login.html?next=/admin/dashboard.html`.

The optional `next` query parameter only accepts same-site relative paths. Admin `next` paths are honored only for admin/staff/viewer accounts.

### Email / password

- Passwords are hashed with **bcrypt** (`bcrypt` package).
- `POST /api/auth/register` — creates **GUEST** users.
- `POST /api/auth/login` — sets JWT in **HTTP-only** cookie (`auth_token`), `sameSite=lax`, `secure` in production.
- `GET /api/auth/me` — returns the current user (requires cookie or `Authorization: Bearer`).
- `POST /api/auth/logout` — clears the JWT cookie and Passport session; logs `LOGOUT` when possible.

### Google OAuth (Passport)

Routes:

- `GET /api/auth/google` — starts OAuth
- `GET /api/auth/google/callback` — completes OAuth, sets JWT cookie, redirects

**Google Cloud Console**

1. Create a project (or use an existing one) → **APIs & Services** → **Credentials**.
2. **Create credentials** → **OAuth client ID** → Application type: **Web application**.
3. Under **Authorized redirect URIs**, add:
   - Local: `http://localhost:10000/api/auth/google/callback`
   - Render: `https://mamagan-booking-system.onrender.com/api/auth/google/callback`
4. Copy **Client ID** and **Client secret** into environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` (must match the redirect URI host/path exactly)

**Behavior**

- Uses a **verified** Google email only.
- If the email already exists, the Google account is **linked** (`oauth_accounts`); **role** and **access_tier** are not upgraded by OAuth.
- New users are **GUEST** with `password_hash` NULL.
- Inactive users (`active` false) cannot complete OAuth.

### GitHub OAuth (Passport)

Routes:

- `GET /api/auth/github`
- `GET /api/auth/github/callback`

**GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**

- **Homepage URL:** `http://localhost:10000` (local) or your Render URL in production.
- **Authorization callback URL** must match how GitHub routes callbacks:
  - Local: `http://localhost:10000/api/auth/github/callback`
  - Production: `https://mamagan-booking-system.onrender.com/api/auth/github/callback`

Set:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`

**GitHub callback limitation:** each OAuth app allows **one** callback URL. For both local and Render you typically create **two** OAuth apps (development and production) with the same scopes, and use different env files / Render env groups.

**Email rules**

- Primary source: a verified **primary** email from the GitHub profile when present.
- If missing, the server calls `https://api.github.com/user/emails` with the short-lived OAuth access token and uses only a verified **primary** email. Tokens are **not** stored in the database.

### Admin OAuth

The unified login page offers the same Google/GitHub links. **OAuth never creates an admin:** a Google/GitHub sign-in only reaches the admin dashboard if the linked user already has an admin/staff/viewer role or access tier for that email.

### Admin account creation

Set these variables locally or in Render:

```bash
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_PHONE=
```

Then run:

```bash
npm run db:seed
```

Optional admin-only repair/create command:

```bash
npm run create-admin
```

The admin bootstrap creates or updates the account as `role = ADMIN` and `access_tier = SUPER_ADMIN`, hashes `ADMIN_PASSWORD` with bcrypt, and never stores a hardcoded password.

### Optional route

- `GET /api/auth/oauth/failure` — redirects to `OAUTH_FAILURE_REDIRECT` (default `/login.html?error=oauth_failed`).

### Security middleware

- **Helmet** enabled globally.
- **Stricter** `express-rate-limit` on `POST /api/auth/login` and `POST /api/auth/register`; lighter limit on other `/api/auth` traffic.
- CORS uses `CLIENT_URL` (comma-separated list allowed) with `credentials: true`.

---

## Aiven MySQL (SSL)

Set `MYSQL_SSL_CA` to the CA PEM. You may use literal `\n` in a single-line env value; the app replaces `\\n` with real newlines before passing to mysql2 (see `src/config/db.js` and `database/db-config.js`).

---

## Render deployment

`render.yaml` is included as a template. Set:

- `NODE_ENV=production`, `PORT=10000`
- `SERVER_URL` and `CLIENT_URL` to `https://mamagan-booking-system.onrender.com`
- `GOOGLE_CALLBACK_URL=https://mamagan-booking-system.onrender.com/api/auth/google/callback`
- `GITHUB_CALLBACK_URL=https://mamagan-booking-system.onrender.com/api/auth/github/callback`
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE` for the default admin account
- All secrets (`JWT_SECRET`, `SESSION_SECRET`, MySQL, OAuth, PayMongo) in the Render dashboard (`sync: false` placeholders in YAML)

Build: `npm install` — Start: `npm start`. Redeploy after changing Render environment variables, then run `npm run db:seed` or `npm run create-admin` from a shell/job if the admin account needs to be created.

### OAuth test checklist

1. Set `JWT_SECRET`, `SESSION_SECRET`, database env vars, and the relevant OAuth client ID/secret/callback URL.
2. Run `npm install`, `npm run db:migrate`, and `npm run db:seed`.
3. Start locally with `npm run dev` and open `/login.html`.
4. Test `/api/auth/google` and `/api/auth/github`; successful guest logins should land on `/facilities.html`.
5. Link an existing admin email through OAuth; it should preserve the admin role and land on `/admin/dashboard.html`.
6. Disable a user (`active=0`) and confirm OAuth returns `/login.html?error=account_disabled`.

---

## System logs

Login, logout, redirects, admin bootstrap, unauthorized admin access, and OAuth events are written to `system_logs` when the table exists. Actions include for example `LOCAL_LOGIN_SUCCESS`, `LOGIN_REDIRECT_ADMIN`, `LOGIN_REDIRECT_GUEST`, `ADMIN_ACCOUNT_CREATED`, `ADMIN_ACCOUNT_UPDATED`, `UNAUTHORIZED_ADMIN_ACCESS`, `ADMIN_LOGIN_PAGE_REDIRECTED`, `GOOGLE_LOGIN_SUCCESS`, `GITHUB_LOGIN_FAILED`, `OAUTH_ACCOUNT_LINKED`, `USER_CREATED_FROM_OAUTH`, and `LOGOUT`. Timestamps are stored in `created_at`.

---

## API summary (auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/google/callback` | Google callback |
| GET | `/api/auth/github` | Start GitHub OAuth |
| GET | `/api/auth/github/callback` | GitHub callback |
| GET | `/api/auth/oauth/failure` | Safe failure redirect |

---

## PayMongo (GCash)

1. Create a PayMongo account and obtain API keys.
2. Set `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`, and `PAYMONGO_WEBHOOK_SECRET` in the environment.
3. Configure a webhook in the PayMongo dashboard pointing at your deployed URL, for example:  
   `https://YOUR-RENDER-APP.onrender.com/api/payments/paymongo/webhook`  
   and subscribe to checkout events you handle in code.

For local development without PayMongo, set `MOCK_PAYMENTS=true`.

---

## Documentation

- PlantUML use case diagram: `docs/use-case-diagram.puml` (actors: Guest, Staff/Admin, PayMongo, System Administrator).

---

## Scripts

| Script | Command |
|--------|---------|
| Start (production) | `npm start` |
| Dev (nodemon) | `npm run dev` |
| Migrations | `npm run db:migrate` |
| Seed | `npm run db:seed` |
| Create/update admin | `npm run create-admin` |
