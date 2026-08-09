Node/Express backend for announcements

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

After starting the server open `http://localhost:3000/admin.html`.
