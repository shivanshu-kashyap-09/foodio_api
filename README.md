# Foodio API

This folder contains the Foodio backend API — an Express server that provides endpoints used by the frontend in `../foodio`.

## Quick start

Prerequisites:

- Node.js (v16+ recommended)
- npm

Install and start the server:

```powershell
cd <path-to-repo>/foodio_api
npm install
node index.js
```

By default the server listens on port 3000 (see `index.js`).

## Environment variables

The project uses `dotenv` to load environment variables. For security reasons the actual `.env` file is not checked into git. Create a `.env` file in this folder with the variables below. A template is provided as `.env.example`.

Required environment variables

- `HOST_NAME` — MySQL host (for example `localhost`)
- `USER` — MySQL username
- `PASSWORD` — MySQL password
- `DATABASE` — MySQL database name (e.g., `foodio`)
- `REDIS_URL` — Redis connection string (e.g., `redis://localhost:6379`)
- `MAIL` — Email address used to send verification and OTP emails (Gmail address if using Gmail service)
- `MAIL_PASSWORD` — App password or email account password (use app password for Gmail + 2FA)
- `URL` — Base public URL used to construct verification links (e.g., `http://localhost:3000` or your deployed domain)

Example `.env` (do NOT commit a real `.env` with secrets): see `.env.example`

## Notes

- The app stores session-like data (OTPs, cached user objects) in Redis. Make sure your Redis server is reachable via `REDIS_URL`.
- The mailer uses `nodemailer` with `service: "gmail"` by default. For Gmail, create an app-specific password if your account has 2FA enabled and prefer using that instead of your main account password.
- Database connection is created in `db.js` using `mysql2`. Ensure the `HOST_NAME`, `USER`, `PASSWORD`, and `DATABASE` are correct and the MySQL server has the expected schema/tables (there are .ibd files in the project for reference).

## Endpoints (high level)

- `GET /` — welcome text
- `GET /ping` — health check
- `/user/*` — user auth, signup, login, verify, forget-password, OTP verification, password reset
- `/thali/*`, `/vegmenu/*`, `/nonvegmenu/*`, `/southindianmenu/*`, and restaurant routes under `/vegrestaurant`, `/nonvegrestaurant`, etc.

For the full list of routes, inspect the `routes/` folder.
