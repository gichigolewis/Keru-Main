const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
}
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}
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
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '4.5mb' }));
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
app.get('/api/healthz', (_req, res) => res.status(200).json({ ok: true }));

const appRoutes = [
  '/', '/index.html', '/about', '/about.html', '/ministries', '/ministries.html',
  '/sermons', '/sermons.html', '/giving', '/giving.html', '/blogs', '/blogs.html',
  '/login', '/login.html', '/register', '/register.html', '/announcements',
  '/announcements.html', '/admin', '/admin.html'
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
  const rows = await query`SELECT p.id, p.member_id, p.title, p.content, p.category, p.author, p.created_at,
      (SELECT '/api/community/posts/' || p.id::text || '/media/' || m.id::text
        FROM community_post_media m WHERE m.post_id = p.id AND m.kind = 'cover' LIMIT 1) AS cover_photo,
      COALESCE((SELECT json_agg(json_build_object(
        'name', m.name,
        'type', m.mime_type,
        'url', '/api/community/posts/' || p.id::text || '/media/' || m.id::text
      ) ORDER BY m.position)
        FROM community_post_media m WHERE m.post_id = p.id AND m.kind = 'attachment'), '[]'::json) AS media,
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
    memberId: post.member_id,
    title: post.title,
    content: post.content,
    category: post.category,
    author: post.author,
    coverPhoto: post.cover_photo || null,
    media: post.media || [],
    date: createdAt.toISOString().slice(0, 10),
    createdAt: createdAt.toISOString(),
    likes: Number(post.likes || 0),
    likedByMe: Boolean(post.liked_by_me),
    comments: post.comments || []
  };
}

app.get('/api/community/posts', optionalMember, asyncRoute(async (req, res) => {
  const query = getSql();
  const viewerId = req.member?.id || null;
  const posts = await query`SELECT p.id, p.member_id, p.title, p.content, p.category, p.author, p.created_at,
      (SELECT '/api/community/posts/' || p.id::text || '/media/' || m.id::text
        FROM community_post_media m WHERE m.post_id = p.id AND m.kind = 'cover' LIMIT 1) AS cover_photo,
      COALESCE((SELECT json_agg(json_build_object(
        'name', m.name,
        'type', m.mime_type,
        'url', '/api/community/posts/' || p.id::text || '/media/' || m.id::text
      ) ORDER BY m.position)
        FROM community_post_media m WHERE m.post_id = p.id AND m.kind = 'attachment'), '[]'::json) AS media,
      (SELECT COUNT(*)::int FROM community_likes l WHERE l.post_id = p.id) AS likes,
      EXISTS (SELECT 1 FROM community_likes l WHERE l.post_id = p.id AND l.member_id = ${viewerId}) AS liked_by_me,
      COALESCE((SELECT json_agg(json_build_object('author', c.author, 'content', c.content) ORDER BY c.created_at)
        FROM community_comments c WHERE c.post_id = p.id), '[]'::json) AS comments
    FROM community_posts p ORDER BY p.created_at DESC LIMIT 100`;
  res.json(posts.map(formatCommunityPost));
}));

app.get('/api/community/posts/:id/media/:mediaId', asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id) || !isUuid(req.params.mediaId)) {
    return res.status(404).json({ error: 'Story media not found.' });
  }
  const query = getSql();
  const rows = await query`SELECT mime_type, data_url
    FROM community_post_media WHERE id = ${req.params.mediaId} AND post_id = ${req.params.id} LIMIT 1`;
  if (!rows.length) return res.status(404).json({ error: 'Story media not found.' });
  const data = rows[0].data_url.split(',')[1];
  const buffer = Buffer.from(data, 'base64');
  res.set('Content-Type', rows[0].mime_type);
  res.set('Content-Disposition', 'inline');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Accept-Ranges', 'bytes');
  const range = req.get('range');
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) {
      return res.status(416).set('Content-Range', `bytes */${buffer.length}`).end();
    }
    const start = match[1] ? Number(match[1]) : Math.max(0, buffer.length - Number(match[2]));
    const end = match[2] ? Number(match[2]) : buffer.length - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= buffer.length) {
      return res.status(416).set('Content-Range', `bytes */${buffer.length}`).end();
    }
    const chunk = buffer.subarray(start, end + 1);
    return res.status(206)
      .set('Content-Range', `bytes ${start}-${end}/${buffer.length}`)
      .set('Content-Length', String(chunk.length))
      .end(chunk);
  }
  res.set('Content-Length', String(buffer.length));
  res.send(buffer);
}));

app.get('/api/community/posts/count', asyncRoute(async (req, res) => {
  const since = Number(req.query.since) || 0;
  const query = getSql();
  const rows = await query`SELECT
      (SELECT COUNT(*)::int FROM community_posts WHERE created_at > to_timestamp(${since / 1000})) AS count,
      (SELECT COALESCE(EXTRACT(EPOCH FROM MAX(created_at)) * 1000, 0) FROM community_posts) AS latest`;
  res.json({ count: rows[0].count, latest: Math.ceil(Number(rows[0].latest) || 0) });
}));

const storyMediaTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);
const storyCoverTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxStoryAssetBytes = 2.5 * 1024 * 1024;
const maxCoverPhotoBytes = 2 * 1024 * 1024;

function validateStoryAsset(asset, acceptedTypes, maxBytes) {
  if (typeof asset !== 'string') return null;
  const match = asset.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || !acceptedTypes.has(match[1].toLowerCase())) return null;
  const encoded = match[2];
  if (encoded.length % 4 !== 0) return null;
  const bytes = Math.floor(encoded.length * 3 / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (bytes <= 0 || bytes > maxBytes) return null;
  return { dataUrl: asset, bytes, mimeType: match[1].toLowerCase() };
}

app.post('/api/community/posts', requireMember, asyncRoute(async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const category = req.body?.category;
  if (!title || title.length > 80) return res.status(400).json({ error: 'Title is required and must be 80 characters or fewer.' });
  if (!content) return res.status(400).json({ error: 'Story text is required.' });
  if (!['Faith', 'Life', 'Service'].includes(category)) return res.status(400).json({ error: 'Choose a valid story category.' });
  const coverPhoto = req.body?.coverPhoto
    ? validateStoryAsset(req.body.coverPhoto, storyCoverTypes, maxCoverPhotoBytes)
    : null;
  if (req.body?.coverPhoto && !coverPhoto) {
    return res.status(400).json({ error: 'Cover photos must be JPG, PNG, or WebP images no larger than 2 MB.' });
  }
  const submittedMedia = req.body?.media ?? [];
  if (!Array.isArray(submittedMedia) || submittedMedia.length > 4) {
    return res.status(400).json({ error: 'Add no more than 4 story images or videos.' });
  }
  const media = [];
  let totalAssetBytes = coverPhoto?.bytes || 0;
  for (const [index, item] of submittedMedia.entries()) {
    const asset = validateStoryAsset(item?.dataUrl, storyMediaTypes, maxStoryAssetBytes);
    if (!asset) {
      return res.status(400).json({ error: 'Story media must be JPG, PNG, WebP, MP4, or WebM files.' });
    }
    totalAssetBytes += asset.bytes;
    if (totalAssetBytes > maxStoryAssetBytes) {
      return res.status(400).json({ error: 'All cover and story media must be 2.5 MB or smaller.' });
    }
    const name = typeof item.name === 'string' ? item.name.split(/[\\/]/).pop().slice(0, 100) : `story-media-${index + 1}`;
    media.push({ name: name || `story-media-${index + 1}`, ...asset });
  }
  const query = getSql();
  const assets = [];
  if (coverPhoto) {
    assets.push({
      kind: 'cover',
      position: 0,
      name: 'story-cover',
      mime_type: coverPhoto.mimeType,
      data_url: coverPhoto.dataUrl
    });
  }
  for (const [index, item] of media.entries()) {
    assets.push({
      kind: 'attachment',
      position: index,
      name: item.name,
      mime_type: item.mimeType,
      data_url: item.dataUrl
    });
  }
  const rows = await query`WITH new_post AS (
      INSERT INTO community_posts (member_id, author, title, content, category)
      VALUES (${req.member.id}, ${req.member.name}, ${title}, ${content}, ${category})
      RETURNING id
    ),
    new_media AS (
      INSERT INTO community_post_media (post_id, kind, position, name, mime_type, data_url)
      SELECT new_post.id, asset.kind, asset.position, asset.name, asset.mime_type, asset.data_url
      FROM new_post
      CROSS JOIN jsonb_to_recordset(${JSON.stringify(assets)}::jsonb) AS asset(
        kind TEXT, position INTEGER, name VARCHAR(100), mime_type TEXT, data_url TEXT
      )
      RETURNING post_id
    )
    SELECT id FROM new_post`;
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

app.delete('/api/community/posts/:id', asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Story not found.' });

  let isAdmin = false;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Basic ')) {
    const creds = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
    const separator = creds.indexOf(':');
    const username = separator < 0 ? '' : creds.slice(0, separator);
    const password = separator < 0 ? '' : creds.slice(separator + 1);
    if (await findAdmin(username, password)) {
      isAdmin = true;
    }
  }

  let member = null;
  if (!isAdmin) {
    member = await resolveMember(req);
  }

  if (!isAdmin && !member) {
    return res.status(401).json({ error: 'Sign in to delete this story.' });
  }

  const query = getSql();
  let rows;
  if (isAdmin) {
    rows = await query`DELETE FROM community_posts WHERE id = ${req.params.id} RETURNING id`;
  } else {
    rows = await query`DELETE FROM community_posts WHERE id = ${req.params.id} AND member_id = ${member.id} RETURNING id`;
  }

  if (!rows.length) {
    return res.status(404).json({ error: 'Story not found or you are not authorized to delete it.' });
  }

  res.status(204).end();
}));

app.get('/api/announcements', asyncRoute(async (_req, res) => {
  const query = getSql();
  const list = await query`SELECT id, title, content, date, created_at AS "createdAt" FROM announcements ORDER BY created_at DESC`;
  res.json(list);
}));

app.get('/api/announcements/count', asyncRoute(async (req, res) => {
  const since = Number(req.query.since) || 0;
  const query = getSql();
  const rows = await query`SELECT
      (SELECT COUNT(*)::int FROM announcements WHERE created_at > to_timestamp(${since / 1000})) AS count,
      (SELECT COALESCE(EXTRACT(EPOCH FROM MAX(created_at)) * 1000, 0) FROM announcements) AS latest`;
  res.json({ count: rows[0].count, latest: Math.ceil(Number(rows[0].latest) || 0) });
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

function buildProgramPdf(title, body) {
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 56;
  const fontSize = 11;
  const lineHeight = 16;
  const titleSize = 20;
  const escape = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const textLines = [];
  const titleChars = Math.floor((pageW - margin * 2) / (titleSize * 0.56));
  let titleStr = title || 'Church Program';
  while (titleStr.length > 0) {
    textLines.push({ t: titleStr.slice(0, titleChars), s: titleSize });
    titleStr = titleStr.slice(titleChars);
  }
  textLines.push({ t: '', s: fontSize });

  const bodyChars = Math.floor((pageW - margin * 2) / (fontSize * 0.56));
  for (const raw of String(body || '').split('\n')) {
    if (!raw.trim()) { textLines.push({ t: '', s: fontSize }); continue; }
    let str = raw;
    while (str.length > 0) {
      textLines.push({ t: str.slice(0, bodyChars), s: fontSize });
      str = str.slice(bodyChars);
    }
  }

  const linesPerPage = Math.floor((pageH - margin * 2 - 40) / lineHeight);
  const pages = [];
  for (let i = 0; i < textLines.length; i += linesPerPage) {
    pages.push(textLines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push([]);

  const contentStreams = pages.map((page) => {
    let y = pageH - margin - 30;
    let s = 'BT\n';
    for (const line of page) {
      if (!line.t) { y -= lineHeight; continue; }
      s += `/F1 ${line.s} Tf\n`;
      s += `1 0 0 1 ${margin} ${y.toFixed(2)} Tm\n`;
      s += `(${escape(line.t)}) Tj\n`;
      y -= lineHeight;
    }
    s += 'ET';
    return s;
  });

  const objs = [];
  objs.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objs.push(`2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj`);
  pages.forEach((_, i) => {
    objs.push(`${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${3 + pages.length + i} 0 R /Resources << /Font << /F1 ${3 + 3 * pages.length} 0 R >> >> >>\nendobj`);
  });
  contentStreams.forEach((stream, i) => {
    const data = Buffer.from(stream, 'latin1');
    objs.push(`${3 + pages.length + i} 0 obj\n<< /Length ${data.length} >>\nstream\n${stream}\nendstream\nendobj`);
  });
  objs.push(`${3 + 3 * pages.length} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const o of objs) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += o + '\n';
  }
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
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

app.get('/api/admin/users', checkAuth, asyncRoute(async (_req, res) => {
  const query = getSql();
  const sessions = await query`
    SELECT 
      s.id AS "sessionId",
      m.id AS "memberId",
      m.name,
      m.email,
      s.created_at AS "loggedInAt",
      s.expires_at AS "expiresAt"
    FROM member_sessions s
    JOIN members m ON m.id = s.member_id
    WHERE s.expires_at > NOW()
    ORDER BY s.created_at DESC
  `;
  res.json(sessions);
}));

app.delete('/api/admin/users/:sessionId', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.sessionId)) return res.status(404).json({ error: 'not found' });
  const query = getSql();
  const rows = await query`DELETE FROM member_sessions WHERE id = ${req.params.sessionId} RETURNING id`;
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

function parseSubmission(req, res, type) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const visibility = req.body?.visibility === 'public' ? 'public' : 'anonymous';
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  if (name && name.length > 80) return res.status(400).json({ error: 'Name must be 80 characters or fewer.' });
  return { name, message, visibility };
}

app.post('/api/prayer-requests', asyncRoute(async (req, res) => {
  const parsed = parseSubmission(req, res, 'prayer');
  if (res.headersSent) return;
  const query = getSql();
  const rows = await query`INSERT INTO prayer_requests (name, message, visibility)
    VALUES (${parsed.name}, ${parsed.message}, ${parsed.visibility})
    RETURNING id, name, message, visibility, created_at`;
  res.status(201).json(rows[0]);
}));

app.get('/api/prayer-requests', checkAuth, asyncRoute(async (_req, res) => {
  const query = getSql();
  const rows = await query`SELECT id, name, message, visibility, created_at FROM prayer_requests ORDER BY created_at DESC`;
  res.json(rows);
}));

app.post('/api/feedback', asyncRoute(async (req, res) => {
  const parsed = parseSubmission(req, res, 'feedback');
  if (res.headersSent) return;
  const query = getSql();
  const rows = await query`INSERT INTO feedback_submissions (name, message, visibility)
    VALUES (${parsed.name}, ${parsed.message}, ${parsed.visibility})
    RETURNING id, name, message, visibility, created_at`;
  res.status(201).json(rows[0]);
}));

app.get('/api/feedback', checkAuth, asyncRoute(async (_req, res) => {
  const query = getSql();
  const rows = await query`SELECT id, name, message, visibility, created_at FROM feedback_submissions ORDER BY created_at DESC`;
  res.json(rows);
}));

app.delete('/api/prayer-requests/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not found' });
  const query = getSql();
  const rows = await query`DELETE FROM prayer_requests WHERE id = ${req.params.id} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
}));

app.delete('/api/feedback/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not found' });
  const query = getSql();
  const rows = await query`DELETE FROM feedback_submissions WHERE id = ${req.params.id} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
}));

app.get('/api/program', asyncRoute(async (_req, res) => {
  const query = getSql();
  const rows = await query`SELECT title, body, updated_at FROM program_content WHERE id = 1`;
  const row = rows[0];
  if (!row) return res.json({ title: 'Church Program', body: '' });
  res.json({ title: row.title, body: row.body, updatedAt: row.updated_at });
}));

app.put('/api/program', checkAuth, asyncRoute(async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body : '';
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  const query = getSql();
  const rows = await query`UPDATE program_content SET title = ${title}, body = ${body}, updated_at = NOW()
    WHERE id = 1 RETURNING title, body, updated_at`;
  if (!rows.length) {
    await query`INSERT INTO program_content (title, body) VALUES (${title}, ${body})`;
    return res.json({ title, body });
  }
  res.json({ title: rows[0].title, body: rows[0].body, updatedAt: rows[0].updated_at });
}));

app.get('/api/program/pdf', asyncRoute(async (_req, res) => {
  const query = getSql();
  const rows = await query`SELECT title, body FROM program_content WHERE id = 1`;
  const row = rows[0] || { title: 'Church Program', body: '' };
  const pdf = buildProgramPdf(row.title || 'Church Program', row.body || '');
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'attachment; filename="church-program.pdf"');
  res.set('Content-Length', String(pdf.length));
  res.send(pdf);
}));

app.use((error, _req, res, _next) => {
  console.error('API request failed:', error.message);
  if (res.headersSent) return;
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large. Reduce the size of the story text or its attached media and try again.' });
  }
  res.status(500).json({ error: 'The service is temporarily unavailable.' });
});

function start() {
  return app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

if (require.main === module) start();

module.exports = app;
