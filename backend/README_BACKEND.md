# Backend: Express, Vercel Functions, Neon Postgres, and Firebase

The Express API runs as Vercel Node.js Functions and uses Neon Postgres through Neon's serverless HTTP driver. Firebase Authentication handles member and administrator login. The first API request initializes the required database tables and indexes.

## Configure Firebase Authentication

1. Create or select a Firebase project and enable **Authentication → Sign-in method → Email/Password** and **Google**. Add the deployed site domain to Firebase Authentication's authorized domains.
2. Register a Firebase web app. Copy `frontend/.env.example` to `frontend/.env.local` and fill in the web app's API key, auth domain, project ID, and app ID. These client settings are public; do not put a service-account key in frontend code.
3. Create a Firebase service account with Firebase Authentication administration permissions. Copy `backend/.env.example` to `backend/.env` and set `FIREBASE_PROJECT_ID` and `FIREBASE_ADMIN_EMAILS`. For local development, either put the service-account JSON in `FIREBASE_SERVICE_ACCOUNT_JSON` or set `GOOGLE_APPLICATION_CREDENTIALS` to the path of a private service-account JSON file. Keep the key file private and out of Git. For hosted deployments, store the JSON only in the host's secret environment configuration.
4. Create the bootstrap administrator with Email/Password in the Firebase console and verify the email. It must match an entry in `FIREBASE_ADMIN_EMAILS`.

Member registration sends an email verification link. Members must verify their email before signing in or posting. The admin portal uses the same Firebase project; administrators are Firebase Auth users with the `admin` custom claim. Admins can add further admin accounts from the dashboard.

Existing database passwords are no longer used for login. Users need Firebase Auth accounts. When a verified Firebase member signs in with an email matching an old member record, the backend links that Firebase UID to the old profile so their posts and reactions remain associated.

## Configure Neon locally

1. Create a Neon project and database. In the Neon dashboard, open **Connect** and copy the Node.js connection string (prefer the pooled connection string for serverless use).
2. Set `DATABASE_URL` in `backend/.env`; keep this file private. Do not paste the URL into chat or frontend settings.
3. Install from the repository root with `npm install`, then run `npm --prefix backend start`. The local API listens on port 3000. In a separate terminal, run `npm --prefix frontend run dev`.

The database URL should begin with `postgresql://` or `postgres://` and retain Neon's `sslmode=require` option. URL-encode reserved characters in credentials.

## Configure production

In the hosting environment, set:

- `DATABASE_URL` — Neon pooled connection URL
- `FIREBASE_PROJECT_ID` — Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT_JSON` — private service-account JSON for the backend
- `FIREBASE_ADMIN_EMAILS` — comma-separated verified bootstrap admin email addresses
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` — public Firebase web-app config, available at frontend build time

The API routes are provided by `api/index.js` and `api/[...path].js`; `/api/healthz` checks function availability without connecting to the database, and `/api/ping` checks database readiness.

## Data migration note

PostgreSQL stores church content and member profiles. Firebase Auth stores login accounts and credentials. Existing database passwords are not accepted; members need to create Firebase accounts. Verified accounts that use an existing member email are linked to that profile on first use, preserving community posts and reactions.

## API endpoints

- `GET /api/members/me` — get the signed-in Firebase member profile (requires a Firebase ID token as a bearer token)
- `GET /api/community/posts` — list recent community posts
- `POST /api/community/posts` — create a post as the signed-in member (`title`, `content`, `category`)
- `GET /api/community/posts/:id/media/:mediaId` — stream existing story media
- `PUT /api/community/posts/:id/like` — toggle the signed-in member's like
- `POST /api/community/posts/:id/comments` — add a comment (`content`) as the signed-in member
- `GET /api/announcements` — list announcements
- `POST`, `PUT`, `DELETE /api/announcements` — manage announcements (requires a Firebase admin ID token)
- `GET /api/leaders` — list public church leader profiles
- `GET /api/leaders/:id/image` — display a leader portrait
- `GET /api/admin/leaders` — list leader profiles in the admin dashboard (requires a Firebase admin ID token)
- `POST /api/leaders`, `PUT /api/leaders/:id`, `DELETE /api/leaders/:id` — manage leader profiles (requires a Firebase admin ID token)
- `GET /api/auth-check` — validate administrator access for the current Firebase user
- `GET`, `POST`, `DELETE /api/admins` — manage Firebase administrator accounts (requires a Firebase admin ID token)
- `GET /api/admin/users` — list Firebase member accounts (requires a Firebase admin ID token)
- `DELETE /api/admin/users/:uid` — revoke a member's Firebase refresh tokens (requires a Firebase admin ID token)
- `GET /api/sermons` — list published sermons
- `POST`, `PUT`, `DELETE /api/sermons` — manage sermons (requires a Firebase admin ID token)

Community story cover photos accept JPG, PNG, and WebP files up to 2 MB. Stories may include up to four JPG, PNG, WebP, MP4, or WebM attachments; cover plus attachments are limited to 2.5 MB total.

Leader profile images accept JPG, PNG, and WebP files up to 3 MB. The admin dashboard stores the portrait with the leader profile and publishes it on the Church Leaders page.
