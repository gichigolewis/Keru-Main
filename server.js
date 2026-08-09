const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/keru';

app.use(express.json());
app.use(express.static(__dirname));

// Mongoose model
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  date: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', announcementSchema);

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

app.get('/api/announcements', async (_req, res) => {
  const list = await Announcement.find().sort({ createdAt: -1 }).lean();
  res.json(list.map(l => ({ id: l._id.toString(), title: l.title, content: l.content, date: l.date })));
});

app.get('/api/auth-check', checkAuth, (_req, res) => {
  res.json({ ok: true });
});

function checkAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const USER = process.env.ADMIN_USER || 'admin';
  const PASS = process.env.ADMIN_PASS || 'admin';

  if (!auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).end('Unauthorized');
  }
  const creds = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [u, p] = creds.split(':');
  if (u === USER && p === PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).end('Unauthorized');
}

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

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
  } catch (e) {
    console.error('Failed to start server', e);
    process.exit(1);
  }
}

start();
