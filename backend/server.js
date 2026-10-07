const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createHash, randomBytes, randomUUID, scrypt: scryptCallback, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const { getSql, ensureDatabase } = require('./db');
const scrypt = promisify(scryptCallback);

const app = express();
const FRONTEND_PATH = path.join(__dirname, '../frontend');
const BUILD_PATH = path.join(FRONTEND_PATH, 'dist');
const APP_ENTRY = fs.existsSync(path.join(BUILD_PATH, 'index.html'))
  ? path.join(BUILD_PATH, 'index.html')
  : path.join(FRONTEND_PATH, 'index.html');
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER?.trim();
const ADMIN_PASS = process.env.ADMIN_PASS;
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.use(express.json());
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
app.get('/api/healthz', (_req, res) => res.status(200).json({ ok: true }));

const appRoutes = [
  '/', '/index.html', '/about', '/about.html', '/ministries', '/ministries.html',
  '/sermons', '/sermons.html', '/blogs', '/blogs.html', '/login', '/login.html',
  '/register', '/register.html', '/announcements', '/announcements.html', '/admin',
  '/admin.html'
];
app.get(appRoutes, (_req, res) => res.sendFile(APP_ENTRY));
app.use(express.static(BUILD_PATH));
app.use(express.static(FRONTEND_PATH));

app.use('/api', asyncRoute(async (_req, _res, next) => {
  await ensureDatabase();
  next();
}));

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

function formatMember(member) {
  return { id: member.id, name: member.name, email: member.email };
}

async function createPasswordHash(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}

async function issueMemberSession(member) {
  const query = getSql();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await query`INSERT INTO member_sessions (member_id, token_hash, expires_at)
    VALUES (${member.id}, ${tokenHash}, ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)})`;
  return { token, member: formatMember(member) };
}

async function resolveMember(req) {
  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const query = getSql();
  const rows = await query`SELECT m.id, m.name, m.email, s.id AS session_id
    FROM member_sessions s JOIN members m ON m.id = s.member_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > NOW() LIMIT 1`;
  if (!rows.length) return null;
  req.member = rows[0];
  req.memberSession = { id: rows[0].session_id };
  return req.member;
}

const optionalMember = asyncRoute(async (req, _res, next) => {
  await resolveMember(req);
  next();
});

const requireMember = asyncRoute(async (req, res, next) => {
  const member = await resolveMember(req);
  if (!member) return res.status(401).json({ error: 'Sign in as a member to continue.' });
  next();
});

app.post('/api/members/register', asyncRoute(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Enter a name between 2 and 80 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  const { salt, hash } = await createPasswordHash(password);
  const query = getSql();
  try {
    const rows = await query`INSERT INTO members (name, email, password_salt, password_hash)
      VALUES (${name}, ${email}, ${salt}, ${hash})
      RETURNING id, name, email`;
    res.status(201).json(await issueMemberSession(rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
    throw error;
  }
}));

app.post('/api/members/login', asyncRoute(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const query = getSql();
  const rows = await query`SELECT id, name, email, password_salt, password_hash FROM members WHERE email = ${email} LIMIT 1`;
  const member = rows[0];
  if (!member || password.length > 128) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const candidate = await scrypt(password, member.password_salt, 64);
  const expected = Buffer.from(member.password_hash, 'hex');
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  res.json(await issueMemberSession(member));
}));

app.get('/api/members/me', requireMember, (req, res) => {
  res.json({ member: formatMember(req.member) });
});

app.delete('/api/members/session', requireMember, asyncRoute(async (req, res) => {
  const query = getSql();
  await query`DELETE FROM member_sessions WHERE id = ${req.memberSession.id}`;
  res.status(204).end();
}));

async function fetchCommunityPost(id, viewerId = null) {
  const query = getSql();
  const rows = await query`SELECT p.id, p.title, p.content, p.category, p.author, p.created_at,
      (SELECT COUNT(*)::int FROM community_likes l WHERE l.post_id = p.id) AS likes,
      EXISTS (SELECT 1 FROM community_likes l WHERE l.post_id = p.id AND l.member_id = ${viewerId}) AS liked_by_me,
      COALESCE((SELECT json_agg(json_build_object('author', c.author, 'content', c.content) ORDER BY c.created_at)
        FROM community_comments c WHERE c.post_id = p.id), '[]'::json) AS comments
    FROM community_posts p WHERE p.id = ${id} LIMIT 1`;
  return rows[0] || null;
}

function formatCommunityPost(post) {
  const createdAt = new Date(post.created_at || Date.now());
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    category: post.category,
    author: post.author,
    date: createdAt.toISOString().slice(0, 10),
    likes: Number(post.likes || 0),
    likedByMe: Boolean(post.liked_by_me),
    comments: post.comments || []
  };
}

app.get('/api/community/posts', optionalMember, asyncRoute(async (req, res) => {
  const query = getSql();
  const viewerId = req.member?.id || null;
  const posts = await query`SELECT p.id, p.title, p.content, p.category, p.author, p.created_at,
      (SELECT COUNT(*)::int FROM community_likes l WHERE l.post_id = p.id) AS likes,
      EXISTS (SELECT 1 FROM community_likes l WHERE l.post_id = p.id AND l.member_id = ${viewerId}) AS liked_by_me,
      COALESCE((SELECT json_agg(json_build_object('author', c.author, 'content', c.content) ORDER BY c.created_at)
        FROM community_comments c WHERE c.post_id = p.id), '[]'::json) AS comments
    FROM community_posts p ORDER BY p.created_at DESC LIMIT 100`;
  res.json(posts.map(formatCommunityPost));
}));

app.post('/api/community/posts', requireMember, asyncRoute(async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const category = req.body?.category;
  if (!title || title.length > 80) return res.status(400).json({ error: 'Title is required and must be 80 characters or fewer.' });
  if (!content || content.length > 700) return res.status(400).json({ error: 'Story text is required and must be 700 characters or fewer.' });
  if (!['Faith', 'Life', 'Service'].includes(category)) return res.status(400).json({ error: 'Choose a valid story category.' });
  const query = getSql();
  const rows = await query`INSERT INTO community_posts (member_id, author, title, content, category)
    VALUES (${req.member.id}, ${req.member.name}, ${title}, ${content}, ${category}) RETURNING id`;
  const post = await fetchCommunityPost(rows[0].id, req.member.id);
  res.status(201).json({ post: formatCommunityPost(post) });
}));

app.put('/api/community/posts/:id/like', requireMember, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Story not found.' });
  const query = getSql();
  const post = await fetchCommunityPost(req.params.id, req.member.id);
  if (!post) return res.status(404).json({ error: 'Story not found.' });
  await query`WITH removed AS (
      DELETE FROM community_likes WHERE post_id = ${req.params.id} AND member_id = ${req.member.id} RETURNING 1
    )
    INSERT INTO community_likes (post_id, member_id)
    SELECT ${req.params.id}, ${req.member.id}
    WHERE NOT EXISTS (SELECT 1 FROM removed)
    ON CONFLICT (post_id, member_id) DO NOTHING`;
  const updatedPost = await fetchCommunityPost(req.params.id, req.member.id);
  res.json({ post: formatCommunityPost(updatedPost) });
}));

app.post('/api/community/posts/:id/comments', requireMember, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Story not found.' });
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 240) return res.status(400).json({ error: 'Comment is required and must be 240 characters or fewer.' });
  const query = getSql();
  const post = await fetchCommunityPost(req.params.id, req.member.id);
  if (!post) return res.status(404).json({ error: 'Story not found.' });
  await query`INSERT INTO community_comments (post_id, member_id, author, content)
    VALUES (${req.params.id}, ${req.member.id}, ${req.member.name}, ${content})`;
  const updatedPost = await fetchCommunityPost(req.params.id, req.member.id);
  res.status(201).json({ post: formatCommunityPost(updatedPost) });
}));

app.get('/api/announcements', asyncRoute(async (_req, res) => {
  const query = getSql();
  const list = await query`SELECT id, title, content, date FROM announcements ORDER BY created_at DESC`;
  res.json(list);
}));

app.get('/api/sermons', asyncRoute(async (_req, res) => {
  const query = getSql();
  const list = await query`SELECT id, title, youtube_id AS "youtubeId", date FROM sermons ORDER BY created_at DESC`;
  res.json(list);
}));

app.post('/api/admin-login', asyncRoute(async (req, res) => {
  const { username, password } = req.body || {};
  const admin = await findAdmin(username, password);
  if (!admin) return res.status(401).json({ error: 'Invalid admin credentials' });
  res.json({ ok: true, username: admin.username });
}));

async function findAdmin(username, password) {
  if (!username || !password) return null;
  if (ADMIN_USER && ADMIN_PASS && username === ADMIN_USER && password === ADMIN_PASS) return { username: ADMIN_USER };
  const query = getSql();
  const rows = await query`SELECT id, username FROM admins WHERE username = ${username} AND password = ${password} LIMIT 1`;
  return rows[0] || null;
}

function formatSermon(sermon) {
  return { id: sermon.id, title: sermon.title, youtubeId: sermon.youtube_id, date: sermon.date };
}

const checkAuth = asyncRoute(async (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).end('Unauthorized');
  }
  const creds = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const separator = creds.indexOf(':');
  const username = separator < 0 ? '' : creds.slice(0, separator);
  const password = separator < 0 ? '' : creds.slice(separator + 1);
  if (await findAdmin(username, password)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).end('Unauthorized');
});

app.get('/api/auth-check', checkAuth, (_req, res) => res.json({ ok: true }));

app.get('/api/admins', checkAuth, asyncRoute(async (_req, res) => {
  const query = getSql();
  const admins = await query`SELECT id, username, created_at AS "createdAt" FROM admins ORDER BY created_at DESC`;
  res.json(admins);
}));

app.post('/api/admins', checkAuth, asyncRoute(async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const query = getSql();
  try {
    const rows = await query`INSERT INTO admins (username, password) VALUES (${username}, ${password})
      RETURNING id, username, created_at AS "createdAt"`;
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That username already exists' });
    throw error;
  }
}));

app.delete('/api/admins/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not found' });
  const query = getSql();
  const rows = await query`DELETE FROM admins WHERE id = ${req.params.id} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
}));

app.post('/api/announcements', checkAuth, asyncRoute(async (req, res) => {
  const { title, content, date } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  const query = getSql();
  const rows = await query`INSERT INTO announcements (title, content, date) VALUES (${title}, ${content}, ${date || ''})
    RETURNING id, title, content, date`;
  res.status(201).json(rows[0]);
}));

app.put('/api/announcements/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not found' });
  const { title, content, date } = req.body || {};
  const query = getSql();
  const rows = await query`UPDATE announcements SET title = ${title}, content = ${content}, date = ${date || ''}
    WHERE id = ${req.params.id} RETURNING id, title, content, date`;
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

app.delete('/api/announcements/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not found' });
  const query = getSql();
  const rows = await query`DELETE FROM announcements WHERE id = ${req.params.id} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
}));

app.post('/api/sermons', checkAuth, asyncRoute(async (req, res) => {
  const { title, youtubeId, date } = req.body || {};
  if (!title || !youtubeId) return res.status(400).json({ error: 'title and youtubeId required' });
  const query = getSql();
  const rows = await query`INSERT INTO sermons (title, youtube_id, date) VALUES (${title}, ${youtubeId.trim()}, ${date || ''})
    RETURNING id, title, youtube_id, date`;
  res.status(201).json(formatSermon(rows[0]));
}));

app.put('/api/sermons/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not found' });
  const { title, youtubeId, date } = req.body || {};
  const query = getSql();
  const rows = await query`UPDATE sermons SET title = ${title}, youtube_id = ${youtubeId}, date = ${date || ''}
    WHERE id = ${req.params.id} RETURNING id, title, youtube_id, date`;
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(formatSermon(rows[0]));
}));

app.delete('/api/sermons/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not found' });
  const query = getSql();
  const rows = await query`DELETE FROM sermons WHERE id = ${req.params.id} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
}));

app.use((error, _req, res, _next) => {
  console.error('API request failed:', error.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'The service is temporarily unavailable.' });
});

function start() {
  return app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

if (require.main === module) start();

module.exports = app;
