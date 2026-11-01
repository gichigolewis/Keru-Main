# Backend: Express, Vercel Functions, and Neon Postgres

The Express API runs as Vercel Node.js Functions and uses Neon Postgres through Neon's serverless HTTP driver. The first API request creates the required tables and indexes automatically.

## Configure Neon locally

1. Create a Neon project and database. In the Neon dashboard, open **Connect** and copy the Node.js connection string (prefer the pooled connection string for serverless use).
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`, `ADMIN_USER`, and `ADMIN_PASS`. Keep this file private; it is ignored by Git. Do not paste the URL into chat or frontend settings.
3. Install from the repository root with `npm install`, then run `npm --prefix backend start`. The local API listens on port 3000. In a separate terminal, run `npm --prefix frontend run dev`.

The database URL should begin with `postgresql://` or `postgres://` and retain Neon's `sslmode=require` option. URL-encode reserved characters in credentials. Use a long, unique admin password.

## Configure Vercel production

In Vercel Project → **Settings → Environment Variables**, set these for Production (and Preview/Development if needed):

- `DATABASE_URL` — Neon pooled connection URL
- `ADMIN_USER` — initial dashboard login
- `ADMIN_PASS` — initial dashboard password

Then deploy from the repository root. The API routes are provided by `api/index.js` and `api/[...path].js`; `/api/healthz` checks function availability without connecting to the database, and `/api/ping` checks database readiness.

## Data migration note

The backend now uses PostgreSQL tables for administrators, announcements, church leaders, sermons, members, sessions, posts, likes, and comments. Creating the Neon project does not copy data from the old MongoDB Atlas cluster. The new schema is initialized automatically, but existing Atlas records must be exported and migrated separately if you need to retain them. Keep Atlas intact until you have verified the migrated data and sign-in on Neon.

## API endpoints

- `POST /api/members/register` — create a member account and start a session (`name`, `email`, `password`)
- `POST /api/members/login` — sign in and start a session (`email`, `password`)
- `GET /api/members/me` — get the signed-in member (requires `Authorization: Bearer <token>`)
- `DELETE /api/members/session` — sign out and revoke the current session (requires a bearer token)
- `GET /api/community/posts` — list recent community posts
- `POST /api/community/posts` — create a post as the signed-in member (`title`, `content`, `category`, optional base64 `coverPhoto`, and optional `media` array of `{ name, dataUrl }`)
- `GET /api/community/posts/:id/media/:mediaId` — stream a story cover photo or attachment
- `PUT /api/community/posts/:id/like` — toggle the signed-in member's like
- `POST /api/community/posts/:id/comments` — add a comment (`content`) as the signed-in member
- `GET /api/announcements` — list announcements
- `POST`, `PUT`, `DELETE /api/announcements` — manage announcements (requires Basic Auth)
- `GET /api/leaders` — list public church leader profiles
- `GET /api/leaders/:id/image` — display a leader portrait
- `GET /api/admin/leaders` — list leader profiles in the admin dashboard (requires Basic Auth)
- `POST /api/leaders`, `PUT /api/leaders/:id`, `DELETE /api/leaders/:id` — manage leader profiles (requires Basic Auth)
- `POST /api/admin-login` — validate an admin login
- `GET`, `POST`, `DELETE /api/admins` — manage admin accounts (requires Basic Auth)
- `GET /api/sermons` — list published sermons
- `POST`, `PUT`, `DELETE /api/sermons` — manage sermons (requires Basic Auth)

Member passwords are stored as scrypt hashes. Member sessions use revocable opaque bearer tokens with a 30-day expiry.

Community story cover photos accept JPG, PNG, and WebP files up to 2 MB. Stories may include up to four JPG, PNG, WebP, MP4, or WebM attachments; cover plus attachments are limited to 2.5 MB total.

Leader profile images accept JPG, PNG, and WebP files up to 3 MB. The admin dashboard stores the portrait with the leader profile and publishes it on the Church Leaders page.
