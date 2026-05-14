# TODO

## Google OAuth (Part 4) — checklist

- [x] Install packages: passport, passport-google-oauth20, express-session, express-mysql-session
- [x] Update `server.js`: configure express-session (MySQL store), initialize passport
- [x] Add migration: create `oauth_accounts` table (supports GOOGLE + future providers)
- [x] Implement routes: `GET /api/auth/google` and `GET /api/auth/google/callback` (backend)
- [x] Implement callback logic: verify Google email, link/create user, preserve role/access_tier, deny if `active=false`, issue JWT cookie after success, redirect based on role
- [ ] Update `public/login.html`: add Continue with Google button + oauth_failed error display
- [ ] Update `public/js/auth.js`: show `oauth_failed` when `?error=oauth_failed`
- [ ] Update `.env.example` with SESSION_SECRET + GOOGLE_* + redirect vars (placeholders only)
- [x] Update README with Google OAuth setup instructions
- [ ] Security review: ensure no client secret leakage, no open redirects, no permanent token storage

