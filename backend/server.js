require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const FRONTEND_PATH = path.join(__dirname, '../frontend');
const BUILD_PATH = path.join(FRONTEND_PATH, 'dist');
const APP_ENTRY = fs.existsSync(path.join(BUILD_PATH, 'index.html'))
  ? path.join(BUILD_PATH, 'index.html')
  : path.join(FRONTEND_PATH, 'index.html');
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/keru';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

app.use(express.json());

const appRoutes = [
  '/', '/index.html', '/about', '/about.html', '/ministries', '/ministries.html',
  '/sermons', '/sermons.html', '/blogs', '/blogs.html', '/login', '/login.html',
  '/register', '/register.html', '/announcements', '/announcements.html', '/admin',
  '/admin.html'
];

app.get(appRoutes, (_req, res) => res.sendFile(APP_ENTRY));
app.use(express.static(BUILD_PATH));
app.use(express.static(FRONTEND_PATH));

// Mongoose model
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  date: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', announcementSchema);

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Admin = mongoose.model('Admin', adminSchema);

const sermonSchema = new mongoose.Schema({
  title: { type: String, required: true },
  youtubeId: { type: String, required: true },
  date: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Sermon = mongoose.model('Sermon', sermonSchema);

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

app.get('/api/announcements', async (_req, res) => {
  const list = await Announcement.find().sort({ createdAt: -1 }).lean();
  res.json(list.map(l => ({ id: l._id.toString(), title: l.title, content: l.content, date: l.date })));
});

app.get('/api/sermons', async (_req, res) => {
  const list = await Sermon.find().sort({ createdAt: -1 }).lean();
  res.json(list.map(formatSermon));
});

app.post('/api/admin-login', async (req, res) => {
  const { username, password } = req.body || {};
  const admin = await findAdmin(username, password);
  if (!admin) return res.status(401).json({ error: 'Invalid admin credentials' });
  res.json({ ok: true, username: admin.username });
});

app.get('/api/auth-check', checkAuth, (_req, res) => {
  res.json({ ok: true });
});

async function findAdmin(username, password) {
  if (!username || !password) return null;
  if (username === ADMIN_USER && password === ADMIN_PASS) return { username };
  return Admin.findOne({ username, password }).lean();
}

function formatSermon(sermon) {
  return { id: sermon._id.toString(), title: sermon.title, youtubeId: sermon.youtubeId, date: sermon.date };
}

async function checkAuth(req, res, next) {
  const auth = req.headers.authorization || '';

  if (!auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).end('Unauthorized');
  }
  const creds = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [u, p] = creds.split(':');
  if (await findAdmin(u, p)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).end('Unauthorized');
}

app.get('/api/admins', checkAuth, async (_req, res) => {
  const admins = await Admin.find().sort({ createdAt: -1 }).select('username createdAt').lean();
  res.json(admins.map(admin => ({ id: admin._id.toString(), username: admin.username, createdAt: admin.createdAt })));
});

app.post('/api/admins', checkAuth, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const admin = await Admin.create({ username: username.trim(), password });
    res.status(201).json({ id: admin._id.toString(), username: admin.username, createdAt: admin.createdAt });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That username already exists' });
    res.status(500).json({ error: 'Could not create admin' });
  }
});

app.delete('/api/admins/:id', checkAuth, async (req, res) => {
  const admin = await Admin.findByIdAndDelete(req.params.id);
  if (!admin) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

app.post('/api/announcements', checkAuth, async (req, res) => {
  const { title, content, date } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  const ann = await Announcement.create({ title, content, date: date || '' });
  res.status(201).json({ id: ann._id.toString(), title: ann.title, content: ann.content, date: ann.date });
});

app.put('/api/announcements/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { title, content, date } = req.body;
  const ann = await Announcement.findByIdAndUpdate(id, { title, content, date: date || '' }, { new: true }).lean();
  if (!ann) return res.status(404).json({ error: 'not found' });
  res.json({ id: ann._id.toString(), title: ann.title, content: ann.content, date: ann.date });
});

app.delete('/api/announcements/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  const ann = await Announcement.findByIdAndDelete(id);
  if (!ann) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

app.post('/api/sermons', checkAuth, async (req, res) => {
  const { title, youtubeId, date } = req.body || {};
  if (!title || !youtubeId) return res.status(400).json({ error: 'title and youtubeId required' });
  const sermon = await Sermon.create({ title, youtubeId: youtubeId.trim(), date: date || '' });
  res.status(201).json(formatSermon(sermon));
});

app.put('/api/sermons/:id', checkAuth, async (req, res) => {
  const { title, youtubeId, date } = req.body || {};
  const sermon = await Sermon.findByIdAndUpdate(req.params.id, { title, youtubeId, date: date || '' }, { new: true }).lean();
  if (!sermon) return res.status(404).json({ error: 'not found' });
  res.json(formatSermon(sermon));
});

app.delete('/api/sermons/:id', checkAuth, async (req, res) => {
  const sermon = await Sermon.findByIdAndDelete(req.params.id);
  if (!sermon) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await Admin.updateOne({ username: ADMIN_USER }, { $setOnInsert: { username: ADMIN_USER, password: ADMIN_PASS } }, { upsert: true });
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
  } catch (e) {
    console.error('Failed to start server', e);
    process.exit(1);
  }
}

start();
