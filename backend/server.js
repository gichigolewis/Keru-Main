const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { createHash, randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(scryptCallback);

const app = express();
const FRONTEND_PATH = path.join(__dirname, '../frontend');
const BUILD_PATH = path.join(FRONTEND_PATH, 'dist');
const APP_ENTRY = fs.existsSync(path.join(BUILD_PATH, 'index.html'))
  ? path.join(BUILD_PATH, 'index.html')
  : path.join(FRONTEND_PATH, 'index.html');
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI?.trim();
const ADMIN_USER = process.env.ADMIN_USER?.trim();
const ADMIN_PASS = process.env.ADMIN_PASS;

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

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordSalt: { type: String, required: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });
const Member = mongoose.model('Member', memberSchema);

const memberSessionSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });
const MemberSession = mongoose.model('MemberSession', memberSessionSchema);

const communityCommentSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  author: { type: String, required: true, maxlength: 80 },
  content: { type: String, required: true, maxlength: 240 },
  createdAt: { type: Date, default: Date.now }
});
const communityPostSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  author: { type: String, required: true, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  content: { type: String, required: true, trim: true, maxlength: 700 },
  category: { type: String, required: true, enum: ['Faith', 'Life', 'Service'] },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
  comments: [communityCommentSchema]
}, { timestamps: true });
const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

let databasePromise;
function ensureDatabase() {
  if (!MONGO_URI) {
    return Promise.reject(new Error('MONGODB_URI is not configured. Set it in backend/.env or your deployment environment.'));
  }
  if (!databasePromise) {
    databasePromise = mongoose.connect(MONGO_URI)
      .then(async () => {
        await Promise.all([Member.init(), MemberSession.init(), CommunityPost.init()]);
      })
      .catch((error) => {
        databasePromise = undefined;
        throw error;
      });
  }
  return databasePromise;
}

app.use(async (_req, _res, next) => {
  try {
    await ensureDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

function formatMember(member) {
  return { id: member._id.toString(), name: member.name, email: member.email };
}

async function createPasswordHash(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}

async function issueMemberSession(member) {
  const token = randomBytes(32).toString('base64url');
  await MemberSession.create({
    memberId: member._id,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  return { token, member: formatMember(member) };
}

async function resolveMember(req) {
  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const session = await MemberSession.findOne({
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: { $gt: new Date() }
  });
  if (!session) return null;
  const member = await Member.findById(session.memberId).select('_id name email');
  if (!member) return null;
  req.member = member;
  req.memberSession = session;
  return member;
}

async function optionalMember(req, _res, next) {
  try {
    await resolveMember(req);
    next();
  } catch (error) {
    next(error);
  }
}

async function requireMember(req, res, next) {
  try {
    const member = await resolveMember(req);
    if (!member) return res.status(401).json({ error: 'Sign in as a member to continue.' });
    next();
  } catch (error) {
    next(error);
  }
}

app.post('/api/members/register', async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Enter a name between 2 and 80 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    const { salt, hash } = await createPasswordHash(password);
    const member = await Member.create({ name, email, passwordSalt: salt, passwordHash: hash });
    res.status(201).json(await issueMemberSession(member));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' });
    next(error);
  }
});

app.post('/api/members/login', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const member = await Member.findOne({ email });
    if (!member || password.length > 128) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const candidate = await scrypt(password, member.passwordSalt, 64);
    const expected = Buffer.from(member.passwordHash, 'hex');
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    res.json(await issueMemberSession(member));
  } catch (error) {
    next(error);
  }
});

app.get('/api/members/me', requireMember, (req, res) => {
  res.json({ member: formatMember(req.member) });
});

app.delete('/api/members/session', requireMember, async (req, res, next) => {
  try {
    await req.memberSession.deleteOne();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function formatCommunityPost(post, viewerId = null) {
  const likedBy = post.likedBy || [];
  const createdAt = new Date(post.createdAt || Date.now());
  return {
    id: post._id.toString(),
    title: post.title,
    content: post.content,
    category: post.category,
    author: post.author,
    date: createdAt.toISOString().slice(0, 10),
    likes: likedBy.length,
    likedByMe: Boolean(viewerId && likedBy.some((id) => id.toString() === viewerId.toString())),
    comments: (post.comments || []).map((comment) => ({
      author: comment.author,
      content: comment.content
    }))
  };
}

app.get('/api/community/posts', optionalMember, async (_req, res, next) => {
  try {
    const posts = await CommunityPost.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(posts.map((post) => formatCommunityPost(post, _req.member?._id)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/community/posts', requireMember, async (req, res, next) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const category = req.body?.category;
    if (!title || title.length > 80) return res.status(400).json({ error: 'Title is required and must be 80 characters or fewer.' });
    if (!content || content.length > 700) return res.status(400).json({ error: 'Story text is required and must be 700 characters or fewer.' });
    if (!['Faith', 'Life', 'Service'].includes(category)) return res.status(400).json({ error: 'Choose a valid story category.' });
    const post = await CommunityPost.create({
      memberId: req.member._id,
      author: req.member.name,
      title,
      content,
      category
    });
    res.status(201).json({ post: formatCommunityPost(post, req.member._id) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/community/posts/:id/like', requireMember, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Story not found.' });
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Story not found.' });
    const memberId = req.member._id.toString();
    const likedIndex = post.likedBy.findIndex((id) => id.toString() === memberId);
    if (likedIndex < 0) post.likedBy.push(req.member._id);
    else post.likedBy.splice(likedIndex, 1);
    await post.save();
    res.json({ post: formatCommunityPost(post, req.member._id) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/community/posts/:id/comments', requireMember, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Story not found.' });
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content || content.length > 240) return res.status(400).json({ error: 'Comment is required and must be 240 characters or fewer.' });
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Story not found.' });
    post.comments.push({ memberId: req.member._id, author: req.member.name, content });
    await post.save();
    res.status(201).json({ post: formatCommunityPost(post, req.member._id) });
  } catch (error) {
    next(error);
  }
});

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
  if (ADMIN_USER && ADMIN_PASS && username === ADMIN_USER && password === ADMIN_PASS) {
    return { username: ADMIN_USER };
  }
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
    await ensureDatabase();
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
  } catch (e) {
    console.error('Failed to start server', e);
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = app;
