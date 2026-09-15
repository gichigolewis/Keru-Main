Node/Express backend for announcements, sermons, and admin accounts

Run the server from the project root:

```powershell
cd "C:\Users\user\Desktop\Keru Main"
npm install
npm start
```

By default the admin credentials are `admin` / `admin`.
To override them in PowerShell, run:

```powershell
$env:ADMIN_USER = 'youruser'
$env:ADMIN_PASS = 'yourpass'
```

Set up MongoDB (local or Atlas) and provide the connection string in `MONGODB_URI`:

```powershell
$env:MONGODB_URI = 'mongodb://localhost:27017/keru'
node server.js
```

API endpoints:
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

After starting the server open `http://localhost:3000/admin.html`.
