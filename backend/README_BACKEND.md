Node/Express backend for announcements, sermons, and admin accounts

Install dependencies from the project root, configure MongoDB, then start the backend:

```powershell
npm install
$env:MONGODB_URI = 'mongodb://localhost:27017/keru'
npm --prefix backend start
```

In a second terminal, start the frontend with `npm --prefix frontend run dev`.

By default the admin credentials are `admin` / `admin`.
To override them in PowerShell, run:

```powershell
$env:ADMIN_USER = 'youruser'
$env:ADMIN_PASS = 'yourpass'
```

For MongoDB Atlas, set `MONGODB_URI` to your Atlas connection string instead. The backend must be able to reach this database for member sign-up, sign-in, and community posts to work.

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
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
ADMIN_USER=<admin-username>
ADMIN_PASS=<strong-admin-password>
```

Deploy from the repository root. Vercel builds the frontend with `npm --prefix frontend run build`, serves the generated SPA, and routes `/api/*` requests to the Express backend.
