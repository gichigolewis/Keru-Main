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
const { getSql, ensureDatabase } = require('./db');
const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const app = express();
const FRONTEND_PATH = path.join(__dirname, '../frontend');
const BUILD_PATH = path.join(FRONTEND_PATH, 'dist');
const APP_ENTRY = fs.existsSync(path.join(BUILD_PATH, 'index.html'))
  ? path.join(BUILD_PATH, 'index.html')
  : path.join(FRONTEND_PATH, 'index.html');
const PORT = process.env.PORT || 3000;
const FIREBASE_ADMIN_EMAILS = new Set(
  (process.env.FIREBASE_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
let firebaseApp;

function getFirebaseAuth() {
  if (!firebaseApp) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const options = {
      projectId: process.env.FIREBASE_PROJECT_ID?.trim() || undefined
    };
    if (serviceAccountJson) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
      } catch {
        const error = new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.');
        error.code = 'FIREBASE_ADMIN_NOT_CONFIGURED';
        throw error;
      }
      options.credential = cert(serviceAccount);
    } else {
      if (
        !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
        !process.env.GOOGLE_CLOUD_PROJECT &&
        !process.env.GCLOUD_PROJECT &&
        !process.env.K_SERVICE
      ) {
        const error = new Error('Configure Firebase Admin with FIREBASE_SERVICE_ACCOUNT_JSON or Google Application Default Credentials.');
        error.code = 'FIREBASE_ADMIN_NOT_CONFIGURED';
        throw error;
      }
      options.credential = applicationDefault();
    }
    firebaseApp = getApps()[0] || initializeApp(options);
  }
  return getAuth(firebaseApp);
}

function isFirebaseAdmin(user) {
  return Boolean(
    user?.email_verified === true &&
    (user.admin === true || FIREBASE_ADMIN_EMAILS.has(String(user.email || '').toLowerCase()))
  );
}

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
  '/announcements.html', '/leaders', '/leaders.html', '/admin', '/admin.html'
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

async function decodeFirebaseUser(req) {
  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  try {
    return await getFirebaseAuth().verifyIdToken(token, true);
  } catch (error) {
    if (error.code === 'FIREBASE_ADMIN_NOT_CONFIGURED') throw error;
    return null;
  }
}

async function resolveMember(req) {
  const firebaseUser = await decodeFirebaseUser(req);
  if (!firebaseUser?.uid || !firebaseUser.email || firebaseUser.email_verified !== true) return null;
  const email = firebaseUser.email.trim().toLowerCase();
  const firebaseName = String(firebaseUser.name || '').trim().slice(0, 80);
  const name = firebaseName || email.split('@')[0] || 'Church member';
  const query = getSql();
  let rows = await query`SELECT id, name, email, firebase_uid FROM members WHERE firebase_uid = ${firebaseUser.uid} LIMIT 1`;
  if (rows.length) {
    const updated = await query`UPDATE members SET
        name = CASE WHEN ${firebaseName} <> '' THEN ${firebaseName} ELSE name END,
        email = ${email}, updated_at = NOW()
      WHERE firebase_uid = ${firebaseUser.uid}
      RETURNING id, name, email`;
    req.member = updated[0];
    req.firebaseUser = firebaseUser;
    return req.member;
  }

  rows = await query`SELECT id, name, email, firebase_uid FROM members WHERE email = ${email} LIMIT 1`;
  if (rows.length) {
    if (rows[0].firebase_uid && rows[0].firebase_uid !== firebaseUser.uid) return null;
    const linked = await query`UPDATE members SET
        firebase_uid = ${firebaseUser.uid},
        name = CASE WHEN ${firebaseName} <> '' THEN ${firebaseName} ELSE name END,
        updated_at = NOW()
      WHERE id = ${rows[0].id} AND firebase_uid IS NULL
      RETURNING id, name, email`;
    if (linked.length) {
      req.member = linked[0];
      req.firebaseUser = firebaseUser;
      return req.member;
    }
    rows = await query`SELECT id, name, email FROM members WHERE firebase_uid = ${firebaseUser.uid} LIMIT 1`;
    if (!rows.length) return null;
    req.member = rows[0];
    req.firebaseUser = firebaseUser;
    return req.member;
  }

  try {
    rows = await query`INSERT INTO members (name, email, firebase_uid)
      VALUES (${name}, ${email}, ${firebaseUser.uid})
      RETURNING id, name, email`;
  } catch (error) {
    if (error.code !== '23505') throw error;
    rows = await query`SELECT id, name, email FROM members WHERE firebase_uid = ${firebaseUser.uid} LIMIT 1`;
  }
  if (!rows.length) return null;
  req.member = rows[0];
  req.firebaseUser = firebaseUser;
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

app.get('/api/members/me', requireMember, (req, res) => {
  res.json({ member: formatMember(req.member) });
});

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

  const firebaseUser = await decodeFirebaseUser(req);
  const isAdmin = isFirebaseAdmin(firebaseUser);

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
  const list = await query`SELECT id, title, youtube_id AS "youtubeId", date,
      media_type AS "mediaType", audio_url AS "audioUrl",
      audio_storage_path AS "audioStoragePath", audio_mime_type AS "audioMimeType"
    FROM sermons ORDER BY created_at DESC`;
  res.json(list);
}));

function formatLeader(leader) {
  return {
    id: leader.id,
    name: leader.name,
    role: leader.role,
    description: leader.description,
    imageUrl: leader.image_data ? `/api/leaders/${leader.id}/image` : ''
  };
}

app.get('/api/leaders', asyncRoute(async (_req, res) => {
  const query = getSql();
  const leaders = await query`SELECT id, name, role, description, image_data
    FROM church_leaders ORDER BY position, name`;
  res.json(leaders.map((leader) => formatLeader(leader)));
}));

app.get('/api/leaders/:id/image', asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).end();
  const query = getSql();
  const rows = await query`SELECT image_data FROM church_leaders WHERE id = ${req.params.id} LIMIT 1`;
  const match = rows[0]?.image_data?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return res.status(404).end();
  res.set('Content-Type', match[1].toLowerCase());
  res.set('Content-Disposition', 'inline');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  res.send(Buffer.from(match[2], 'base64'));
}));

function formatSermon(sermon) {
  return {
    id: sermon.id,
    title: sermon.title,
    youtubeId: sermon.youtube_id || '',
    date: sermon.date,
    mediaType: sermon.media_type || 'video',
    audioUrl: sermon.audio_url || '',
    audioStoragePath: sermon.audio_storage_path || '',
    audioMimeType: sermon.audio_mime_type || ''
  };
}

const sermonAudioMimeTypes = new Set([
  'audio/aac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav'
]);

function parseSermonPayload(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const date = typeof body?.date === 'string' ? body.date : '';
  const mediaType = body?.mediaType || 'video';
  const youtubeId = typeof body?.youtubeId === 'string' ? body.youtubeId.trim() : '';
  const audioUrl = typeof body?.audioUrl === 'string' ? body.audioUrl : '';
  const audioStoragePath = typeof body?.audioStoragePath === 'string' ? body.audioStoragePath : '';
  const audioMimeType = typeof body?.audioMimeType === 'string' ? body.audioMimeType : '';

  if (!title || title.length > 200) {
    return { error: 'A title of 1 to 200 characters is required.' };
  }
  if (!['video', 'song', 'audio-sermon'].includes(mediaType)) {
    return { error: 'Choose video, song, or audio-sermon media.' };
  }
  if (mediaType === 'video') {
    if (!youtubeId) return { error: 'youtubeId is required for video sermons.' };
    return { title, date, mediaType, youtubeId, audioUrl: '', audioStoragePath: '', audioMimeType: '' };
  }
  if (!sermonAudioMimeTypes.has(audioMimeType)) {
    return { error: 'The uploaded audio type is not supported.' };
  }
  if (!audioStoragePath.startsWith('sermon-audio/') || audioStoragePath.includes('..')) {
    return { error: 'The Firebase audio storage path is invalid.' };
  }
  try {
    const url = new URL(audioUrl);
    const objectPath = decodeURIComponent(url.pathname.split('/o/')[1] || '');
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'firebasestorage.googleapis.com' ||
      objectPath !== audioStoragePath ||
      url.searchParams.get('alt') !== 'media' ||
      !url.searchParams.get('token')
    ) {
      return { error: 'The audio URL must be a valid Firebase Storage download URL.' };
    }
  } catch {
    return { error: 'The audio URL must be a valid Firebase Storage download URL.' };
  }
  return { title, date, mediaType, youtubeId: '', audioUrl, audioStoragePath, audioMimeType };
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
  const firebaseUser = await decodeFirebaseUser(req);
  if (!isFirebaseAdmin(firebaseUser)) {
    return res.status(401).json({ error: 'A verified Firebase administrator account is required.' });
  }
  if (FIREBASE_ADMIN_EMAILS.has(String(firebaseUser.email || '').toLowerCase()) && firebaseUser.admin !== true) {
    const auth = getFirebaseAuth();
    const user = await auth.getUser(firebaseUser.uid);
    await auth.setCustomUserClaims(firebaseUser.uid, { ...user.customClaims, admin: true });
  }
  req.admin = firebaseUser;
  next();
});

app.get('/api/auth-check', checkAuth, (req, res) => {
  res.json({ ok: true, uid: req.admin.uid, email: req.admin.email });
});

async function listFirebaseUsers() {
  const auth = getFirebaseAuth();
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function isAdminAccount(user) {
  return user.customClaims?.admin === true ||
    FIREBASE_ADMIN_EMAILS.has(String(user.email || '').toLowerCase());
}

function formatFirebaseAdmin(user) {
  return {
    id: user.uid,
    username: user.email,
    name: user.displayName || user.email,
    createdAt: user.metadata.creationTime,
    isBootstrap: FIREBASE_ADMIN_EMAILS.has(String(user.email || '').toLowerCase())
  };
}

function parseLeaderInput(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const role = typeof body?.role === 'string' ? body.role.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const imageData = typeof body?.imageData === 'string' ? body.imageData : '';
  if (!name || name.length > 100) return { error: 'Name is required and must be 100 characters or fewer.' };
  if (!role || role.length > 120) return { error: 'Role is required and must be 120 characters or fewer.' };
  if (description.length > 3000) return { error: 'Description must be 3,000 characters or fewer.' };
  if (imageData) {
    const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match || match[2].length % 4 !== 0) {
      return { error: 'Leader images must be JPG, PNG, or WebP files.' };
    }
    const bytes = Buffer.from(match[2], 'base64');
    const validType = match[1].toLowerCase();
    const validSignature =
      (validType === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
      (validType === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (validType === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
    if (!validSignature) return { error: 'The selected file is not a valid JPG, PNG, or WebP image.' };
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) {
      return { error: 'Leader images must be no larger than 3 MB.' };
    }
  }
  return { name, role, description, imageData };
}

app.get('/api/admin/leaders', checkAuth, asyncRoute(async (_req, res) => {
  const query = getSql();
  const leaders = await query`SELECT id, name, role, description, image_data, position
    FROM church_leaders ORDER BY position, name`;
  res.json(leaders.map((leader) => ({ ...formatLeader(leader), position: leader.position })));
}));

app.post('/api/leaders', checkAuth, asyncRoute(async (req, res) => {
  const leader = parseLeaderInput(req.body);
  if (leader.error) return res.status(400).json({ error: leader.error });
  const query = getSql();
  const rows = await query`INSERT INTO church_leaders (name, role, description, image_data)
    VALUES (${leader.name}, ${leader.role}, ${leader.description}, ${leader.imageData})
    RETURNING id, name, role, description, image_data`;
  res.status(201).json(formatLeader(rows[0]));
}));

app.put('/api/leaders/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Leader not found.' });
  const leader = parseLeaderInput(req.body);
  if (leader.error) return res.status(400).json({ error: leader.error });
  const removeImage = req.body?.removeImage === true;
  const query = getSql();
  const rows = await query`UPDATE church_leaders SET
      name = ${leader.name},
      role = ${leader.role},
      description = ${leader.description},
      image_data = CASE
        WHEN ${removeImage} THEN ''
        WHEN ${leader.imageData} <> '' THEN ${leader.imageData}
        ELSE image_data
      END,
      updated_at = NOW()
    WHERE id = ${req.params.id}
    RETURNING id, name, role, description, image_data`;
  if (!rows.length) return res.status(404).json({ error: 'Leader not found.' });
  res.json(formatLeader(rows[0]));
}));

app.delete('/api/leaders/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Leader not found.' });
  const query = getSql();
  const rows = await query`DELETE FROM church_leaders WHERE id = ${req.params.id} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'Leader not found.' });
  res.status(204).end();
}));

app.get('/api/admins', checkAuth, asyncRoute(async (req, res) => {
  const users = await listFirebaseUsers();
  res.json(users.filter(isAdminAccount).map((user) => ({
    ...formatFirebaseAdmin(user),
    isSelf: user.uid === req.admin.uid
  })));
}));

app.post('/api/admins', checkAuth, asyncRoute(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Enter a name between 2 and 80 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  try {
    const auth = getFirebaseAuth();
    const user = await auth.createUser({
      displayName: name,
      email,
      emailVerified: true,
      password
    });
    try {
      await auth.setCustomUserClaims(user.uid, { admin: true });
    } catch (error) {
      await auth.deleteUser(user.uid);
      throw error;
    }
    const created = await auth.getUser(user.uid);
    res.status(201).json(formatFirebaseAdmin(created));
  } catch (error) {
    if (error.code === 'auth/email-already-exists') return res.status(409).json({ error: 'An account with that email already exists.' });
    if (error.code?.startsWith('auth/')) return res.status(400).json({ error: error.message });
    throw error;
  }
}));

app.delete('/api/admins/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!req.params.id || req.params.id.length > 128) return res.status(404).json({ error: 'Administrator not found.' });
  if (req.params.id === req.admin.uid) return res.status(400).json({ error: 'You cannot remove your own administrator account.' });
  const auth = getFirebaseAuth();
  const user = await auth.getUser(req.params.id).catch((error) => {
    if (error.code === 'auth/user-not-found') return null;
    throw error;
  });
  if (!user || !isAdminAccount(user)) return res.status(404).json({ error: 'Administrator not found.' });
  if (FIREBASE_ADMIN_EMAILS.has(String(user.email || '').toLowerCase())) {
    return res.status(400).json({ error: 'A bootstrap administrator cannot be removed here. Update FIREBASE_ADMIN_EMAILS to change bootstrap access.' });
  }
  const admins = (await listFirebaseUsers()).filter(isAdminAccount);
  if (admins.length <= 1) return res.status(400).json({ error: 'At least one administrator account must remain.' });
  await auth.deleteUser(user.uid);
  res.status(204).end();
}));

app.get('/api/admin/users', checkAuth, asyncRoute(async (_req, res) => {
  const users = await listFirebaseUsers();
  res.json(users.filter((user) => !isAdminAccount(user)).map((user) => ({
    sessionId: user.uid,
    memberId: user.uid,
    name: user.displayName || user.email,
    email: user.email,
    loggedInAt: user.metadata.lastSignInTime,
    lastSignInAt: user.metadata.lastSignInTime,
    createdAt: user.metadata.creationTime,
    disabled: user.disabled
  })));
}));

app.delete('/api/admin/users/:sessionId', checkAuth, asyncRoute(async (req, res) => {
  if (!req.params.sessionId || req.params.sessionId.length > 128) return res.status(404).json({ error: 'Member account not found.' });
  const auth = getFirebaseAuth();
  const user = await auth.getUser(req.params.sessionId).catch((error) => {
    if (error.code === 'auth/user-not-found') return null;
    throw error;
  });
  if (!user || isAdminAccount(user)) return res.status(404).json({ error: 'Member account not found.' });
  await auth.revokeRefreshTokens(user.uid);
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
  const sermon = parseSermonPayload(req.body);
  if (sermon.error) return res.status(400).json({ error: sermon.error });
  const { title, youtubeId, date, mediaType, audioUrl, audioStoragePath, audioMimeType } = sermon;
  const query = getSql();
  const rows = await query`INSERT INTO sermons
      (title, youtube_id, date, media_type, audio_url, audio_storage_path, audio_mime_type)
    VALUES (${title}, ${youtubeId}, ${date}, ${mediaType}, ${audioUrl}, ${audioStoragePath}, ${audioMimeType})
    RETURNING id, title, youtube_id, date, media_type, audio_url, audio_storage_path, audio_mime_type`;
  res.status(201).json(formatSermon(rows[0]));
}));

app.put('/api/sermons/:id', checkAuth, asyncRoute(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not found' });
  const sermon = parseSermonPayload(req.body);
  if (sermon.error) return res.status(400).json({ error: sermon.error });
  const { title, youtubeId, date, mediaType, audioUrl, audioStoragePath, audioMimeType } = sermon;
  const query = getSql();
  const rows = await query`UPDATE sermons SET title = ${title}, youtube_id = ${youtubeId}, date = ${date},
      media_type = ${mediaType}, audio_url = ${audioUrl},
      audio_storage_path = ${audioStoragePath}, audio_mime_type = ${audioMimeType}
    WHERE id = ${req.params.id}
    RETURNING id, title, youtube_id, date, media_type, audio_url, audio_storage_path, audio_mime_type`;
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
    return res.status(413).json({ error: 'Request payload is too large. Reduce the size of the submitted content or its attached media and try again.' });
  }
  if (error.code === 'FIREBASE_ADMIN_NOT_CONFIGURED') {
    return res.status(503).json({ error: error.message });
  }
  res.status(500).json({ error: 'The service is temporarily unavailable.' });
});

function start() {
  return app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

if (require.main === module) start();

module.exports = app;
