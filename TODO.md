# TODO

- [x] Inspect repo for how `.env` is loaded and which env var names are used.
- [x] Verified DB/jwt/cookie env expectations (code uses `MYSQL_*` and `JWT_SECRET`).
- [x] Added a safe `.env.example` template with correct `MYSQL_*` + `JWT_*` names.
- [ ] Update your local `.env` to map your provided variables to the app’s expected names.
  - Use: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, optional `MYSQL_SSL_CA`.
  - Keep: `JWT_SECRET`, `JWT_EXPIRES_IN`.
- [ ] Run:
  - `npm run db:migrate`
  - `npm run dev`
- [ ] Confirm server boot + DB connection succeeds.

