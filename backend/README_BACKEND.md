Node/Express backend for announcements, sermons, and admin accounts

Install dependencies from the project root, configure MongoDB, then start the backend:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
# Edit backend/.env and replace the MONGODB_URI and admin credentials.
npm --prefix backend start
```

The backend reads `MONGODB_URI` from `backend/.env` locally or from the deployment environment. It no longer silently falls back to a local MongoDB instance, so the server reports a clear configuration error if the URI is missing. For local MongoDB instead of Atlas, explicitly set `MONGODB_URI=mongodb://localhost:27017/keru`.

In a second terminal, start the frontend with `npm --prefix frontend run dev`.

Set the initial admin login in `backend/.env` using `ADMIN_USER` and `ADMIN_PASS`. There are no built-in admin credentials. Additional administrators can be created from the dashboard.
To set credentials for the current PowerShell session instead, run:

```powershell
$env:ADMIN_USER = 'youruser'
$env:ADMIN_PASS = 'yourpass'
```

## Connect MongoDB Atlas

1. Create an Atlas cluster and a **database user** (this is separate from your Atlas website login). Grant the user read/write access to the app database.
2. In Atlas **Network Access**, allow connections from the machine running the backend. For deployment, configure the Vercel app's supported/static outbound IP access as appropriate; avoid opening the database to all IPs unless you have deliberately accepted that exposure.
3. In Atlas, choose **Connect → Drivers → Node.js**, copy the SRV connection string, and replace the username, password, cluster host, and database name. Put the finished URI in `backend/.env` as `MONGODB_URI=...`.
4. URL-encode reserved characters in the database user's password (for example, `@` becomes `%40`). Keep `backend/.env` private; it is ignored by Git. Never put the URI in frontend code or commit it.
5. Start the backend and look for `Connected to MongoDB` in its output. The announcements, sermons, admin accounts, members, sessions, and community content all use this database.

Use the safe template in `backend/.env.example`. Do not commit your populated `.env` file or share a connection string in chat.

API endpoints:
- `POST /api/members/register` — create a member account and start a session (`name`, `email`, `password`)
- `POST /api/members/login` — sign in and start a session (`email`, `password`)
- `GET /api/members/me` — get the signed-in member (requires `Authorization: Bearer <token>`)
- `DELETE /api/members/session` — sign out and revoke the current session (requires a bearer token)
- `GET /api/community/posts` — list recent community posts
- `POST /api/community/posts` — create a post as the signed-in member (`title`, `content`, `category`)
- `PUT /api/community/posts/:id/like` — toggle the signed-in member's like
- `POST /api/community/posts/:id/comments` — add a comment (`content`) as the signed-in member
- `GET /api/announcements` — list
- `POST /api/announcements` — create (requires Basic Auth)
- `PUT /api/announcements/:id` — update (requires Basic Auth)
- `DELETE /api/announcements/:id` — delete (requires Basic Auth)
- `POST /api/admin-login` — validate an admin login
- `GET /api/admins` — list admin accounts (requires Basic Auth)
- `POST /api/admins` — add an admin account (requires Basic Auth)
- `DELETE /api/admins/:id` — remove an admin account (requires Basic Auth)
- `GET /api/sermons` — list published sermons
- `POST /api/sermons` — publish a sermon (requires Basic Auth)
- `PUT /api/sermons/:id` — update a sermon (requires Basic Auth)
- `DELETE /api/sermons/:id` — delete a sermon (requires Basic Auth)

Member passwords are stored as scrypt hashes. Member sessions use revocable, opaque bearer tokens with a 30-day expiry. New member posts, likes, and comments are stored in MongoDB; set `MONGODB_URI` before running the backend.

After starting the server open `http://localhost:3000/admin.html`.

## Deploy on Vercel

The repository includes a root `vercel.json` and exposes the backend through `api/index.js`.
In the Vercel project settings, add these environment variables for Production, Preview, and Development as needed:

```text
MONGODB_URI=mongodb+srv://<db-user>:<encoded-password>@<cluster-host>/keru?retryWrites=true&w=majority
ADMIN_USER=<admin-username>
ADMIN_PASS=<strong-admin-password>
```

Configure Atlas Network Access so Vercel can reach the cluster, following Vercel's current outbound IP guidance for your plan and region. Deploy from the repository root. Vercel builds the frontend with `npm --prefix frontend run build`, serves the generated SPA, and routes `/api/*` requests to the Express backend. Do not use the development admin credentials in a deployed environment.

## Host the API on Render

The root `render.yaml` defines a low-traffic Render web service for the API. To create it, push this repository to GitHub, sign in to Render, choose **New → Blueprint**, and connect the repository. Render will read `render.yaml` and prompt for `MONGODB_URI`, `ADMIN_USER`, and `ADMIN_PASS`; enter the same values used by the current deployment without committing them to the repository. The service is configured for the Ohio region and the free plan; free services can spin down when idle.

After the service is created, open its Render dashboard page and choose **Connect → Outbound**. Copy the displayed outbound IP ranges and add them as CIDR entries in Atlas **Security → Database & Network Access → IP Access List**. These default ranges are shared by Render services in the region; Render offers dedicated outbound IPs as a separately billed option.

Then copy the service's `onrender.com` URL. To keep browser requests same-origin and avoid adding CORS, update the `/api/:path*` rewrite in the root `vercel.json` so it targets `https://<your-service>.onrender.com/api/:path*`, then redeploy the Vercel frontend. Verify `/api/ping` through the Vercel domain after Atlas has activated the IP entries.
