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

The backend now uses PostgreSQL tables for administrators, announcements, sermons, members, sessions, posts, likes, and comments. Creating the Neon project does not copy data from the old MongoDB Atlas cluster. The new schema is initialized automatically, but existing Atlas records must be exported and migrated separately if you need to retain them. Keep Atlas intact until you have verified the migrated data and sign-in on Neon.

## API endpoints

- `POST /api/members/register` — create a member account and start a session (`name`, `email`, `password`)
- `POST /api/members/login` — sign in and start a session (`email`, `password`)
- `GET /api/members/me` — get the signed-in member (requires `Authorization: Bearer <token>`)
- `DELETE /api/members/session` — sign out and revoke the current session (requires a bearer token)
- `GET /api/community/posts` — list recent community posts
- `POST /api/community/media/uploads` — start an authenticated direct upload to Cloudflare R2
- `POST /api/community/media/uploads/part-urls` — sign multipart upload parts
- `POST /api/community/media/uploads/complete` — complete and verify an R2 upload
- `DELETE /api/community/media/uploads` — abort or remove an unfinished upload
- `POST /api/community/posts` — create a post as the signed-in member (`title`, `content`, `category`, optional `coverKey`, and optional `mediaKeys` array)
- `GET /api/community/posts/:id/media/:mediaId` — stream a story cover photo or attachment
- `PUT /api/community/posts/:id/like` — toggle the signed-in member's like
- `POST /api/community/posts/:id/comments` — add a comment (`content`) as the signed-in member
- `GET /api/announcements` — list announcements
- `POST`, `PUT`, `DELETE /api/announcements` — manage announcements (requires Basic Auth)
- `POST /api/admin-login` — validate an admin login
- `GET`, `POST`, `DELETE /api/admins` — manage admin accounts (requires Basic Auth)
- `GET /api/sermons` — list published sermons
- `POST`, `PUT`, `DELETE /api/sermons` — manage sermons (requires Basic Auth)

Member passwords are stored as scrypt hashes. Member sessions use revocable opaque bearer tokens with a 30-day expiry.

Community story cover photos accept JPG, PNG, and WebP. Stories may include up to four JPG, PNG, WebP, MP4, or WebM attachments. Files upload directly to Cloudflare R2 using multipart uploads for large files, without an application size cap; Cloudflare R2's maximum object size is 5 TB per file.

Configure these server environment variables before enabling story media:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Configure the R2 bucket CORS policy to allow `PUT` from the deployed site origin and expose the `ETag` response header. For example, replace the origin below with the production frontend origin:

```json
[
  {
    "AllowedOrigins": ["https://your-site.example"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`ETag` is required to complete multipart video uploads. Set an R2 lifecycle rule to abort incomplete multipart uploads after a few days so abandoned browser uploads do not accumulate.

Each story image/video has its own share button. It shares a stable application media URL, so sharing does not download the full media file into the browser; the browser and receiving app can still impose their own limits.
