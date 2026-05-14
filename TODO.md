# TODO - Mamagan Web App (System Scaffold)

- [ ] Create project scaffold: backend (Node.js/Express) + frontend (static HTML/CSS/JS)
- [ ] Add dependencies + environment configuration (.env.example)
- [ ] Implement OAuth login via Passport:
  - [ ] Google OAuth2 strategy
  - [ ] GitHub OAuth2 strategy
- [ ] Implement session-based auth + protected route middleware
- [ ] Implement MySQL integration (Aiven/MySQL):
  - [ ] Create minimal users schema migration/setup SQL
  - [ ] Upsert user on OAuth callback
- [ ] Create auth APIs:
  - [ ] GET /auth/me (returns current user)
  - [ ] GET /auth/logout
- [ ] Build frontend:
  - [ ] index.html with “Continue with Google/GitHub”
  - [ ] /me status display via fetch
- [ ] Run/test locally: install, start server, validate OAuth flow + /auth/me
- [ ] (Next phase) Continue with booking, availability, admin dashboard, and PayMongo/GCash integration.

