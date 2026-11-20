# Complaint Desk

Complaint Desk is a MongoDB-backed campus complaint desk with a student reporting portal and staff dashboard. Complaint records are stored in MongoDB Atlas; the browser does not use mock or local-storage data.

## Run locally

1. Copy `Backend/.env.example` to `Backend/.env`, then set the Atlas connection string, staff email, and a strong staff password. Keep this file private.
2. Ensure the database user's permissions and Atlas network access allow this machine to connect.
3. From the project root, run `npm install` and then `npm run dev`.
4. Open `http://localhost:5173`. The API listens on `http://localhost:5000`.

Run `npm run seed --workspace Backend` to add three realistic sample complaints if the complaints collection is empty. The API also supports list/search/filter, details, create, edit, status updates, delete, and status-count endpoints under `/api/complaints`.

Staff sign-in uses the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values in `Backend/.env`. Staff sessions use an HTTP-only, same-site cookie and expire after eight hours. Complaint lists, counts, edits, status changes, and deletion require an authenticated staff session. Public complaint tracking returns only the complaint ID, category, status, and submission date.

The AI assistance works offline using deterministic rules for category suggestions, short summaries, and priority. No paid API key is required.

Run `npm test` for backend AI tests and `npm run build` for a production frontend build.
