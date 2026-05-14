# Mamagan Web Application

A facility booking and management system built with Node.js, Express, and MySQL.

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js + Express.js
- **Database:** MySQL (Aiven cloud)
- **Deployment:** Render

## Project Structure

```
MamaganWebApp/
├── server.js                  # Express entry point
├── package.json
├── render.yaml                # Render deployment config
├── .env.example               # Environment variable template
├── .gitignore
│
├── src/
│   ├── config/
│   │   └── db.js              # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   ├── admin.js           # Admin role guard
│   │   └── error.js           # Global error handler
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── facility.routes.js
│   │   └── admin.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── facility.controller.js
│   │   └── admin.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── facility.service.js
│   │   └── admin.service.js
│   └── utils/
│       ├── jwt.js
│       └── hash.js
│
├── public/
│   ├── index.html             # Redirects to login
│   ├── login.html
│   ├── register.html
│   ├── facilities.html
│   ├── css/
│   │   ├── style.css          # Shared styles
│   │   └── admin.css          # Admin styles
│   ├── js/
│   │   ├── auth.js
│   │   └── facilities.js
│   └── admin/
│       ├── login.html
│       ├── dashboard.html
│       └── js/
│           └── dashboard.js
│
├── database/
│   ├── migrations/
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_facilities.sql
│   │   └── 003_create_bookings.sql
│   ├── migrate.js             # Migration runner
│   └── seed.js                # Seed script
│
└── docs/
    └── use-case-diagram.puml
```

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your Aiven MySQL credentials and JWT secret
```

### 3. Run database migrations
```bash
npm run db:migrate
```

### 4. Seed initial data
```bash
npm run db:seed
```

### 5. Start the server
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

## API Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/register | Register new user | Public |
| POST | /api/auth/login | User login | Public |
| GET | /api/auth/me | Get current user | JWT |
| GET | /api/facilities | List all facilities | Public |
| GET | /api/facilities/:id | Get facility detail | Public |
| POST | /api/facilities/:id/book | Book a facility | JWT |
| GET | /api/admin/users | List all users | Admin |
| GET | /api/admin/bookings | List all bookings | Admin |
| PATCH | /api/admin/bookings/:id | Update booking status | Admin |

## Default Admin Account
Set in `.env`:
- Email: `ADMIN_EMAIL`
- Password: `ADMIN_PASSWORD`
