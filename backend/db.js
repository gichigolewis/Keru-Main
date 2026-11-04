const { neon } = require('@neondatabase/serverless');

let sql;
let schemaPromise;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured. Add the Neon connection string to the deployment environment.');
  }
  if (!sql) sql = neon(databaseUrl);
  return sql;
}

async function ensureDatabase() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const query = getSql();
      await query`CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(80) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`UPDATE admins SET password = '' WHERE password <> ''`;
      await query`CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE TABLE IF NOT EXISTS sermons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        youtube_id TEXT NOT NULL,
        date TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE TABLE IF NOT EXISTS church_leaders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        role VARCHAR(120) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        image_data TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE INDEX IF NOT EXISTS church_leaders_position_idx ON church_leaders(position, name)`;
      await query`CREATE TABLE IF NOT EXISTS members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(80) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_salt TEXT,
        password_hash TEXT,
        firebase_uid TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`ALTER TABLE members ALTER COLUMN password_salt DROP NOT NULL`;
      await query`ALTER TABLE members ALTER COLUMN password_hash DROP NOT NULL`;
      await query`ALTER TABLE members ADD COLUMN IF NOT EXISTS firebase_uid TEXT`;
      await query`CREATE UNIQUE INDEX IF NOT EXISTS members_firebase_uid_idx ON members(firebase_uid) WHERE firebase_uid IS NOT NULL`;
      await query`UPDATE members SET password_salt = NULL, password_hash = NULL
        WHERE password_salt IS NOT NULL OR password_hash IS NOT NULL`;
      await query`CREATE TABLE IF NOT EXISTS member_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE INDEX IF NOT EXISTS member_sessions_expires_at_idx ON member_sessions(expires_at)`;
      await query`CREATE TABLE IF NOT EXISTS community_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        author VARCHAR(80) NOT NULL,
        title VARCHAR(80) NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('Faith', 'Life', 'Service')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      // Allow unlimited story text on tables created before this change.
      await query`ALTER TABLE community_posts ALTER COLUMN content TYPE TEXT`;
      await query`CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON community_posts(created_at DESC)`;
      await query`CREATE TABLE IF NOT EXISTS community_post_media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('cover', 'attachment')),
        position INTEGER NOT NULL DEFAULT 0,
        name VARCHAR(100) NOT NULL,
        mime_type TEXT NOT NULL,
        data_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE INDEX IF NOT EXISTS community_post_media_post_position_idx ON community_post_media(post_id, kind, position)`;
      await query`CREATE TABLE IF NOT EXISTS community_likes (
        post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (post_id, member_id)
      )`;
      await query`CREATE TABLE IF NOT EXISTS community_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        author VARCHAR(80) NOT NULL,
        content VARCHAR(240) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE INDEX IF NOT EXISTS community_comments_post_created_idx ON community_comments(post_id, created_at)`;
      await query`CREATE TABLE IF NOT EXISTS prayer_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'anonymous' CHECK (visibility IN ('anonymous', 'public')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE INDEX IF NOT EXISTS prayer_requests_created_at_idx ON prayer_requests(created_at DESC)`;
      await query`CREATE TABLE IF NOT EXISTS feedback_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'anonymous' CHECK (visibility IN ('anonymous', 'public')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE INDEX IF NOT EXISTS feedback_submissions_created_at_idx ON feedback_submissions(created_at DESC)`;
      await query`CREATE TABLE IF NOT EXISTS program_content (
        id INTEGER PRIMARY KEY DEFAULT 1,
        title TEXT NOT NULL DEFAULT 'Church Program',
        body TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (id = 1)
      )`;
      // Seed a default row so GET /api/program always returns something.
      await query`INSERT INTO program_content (title, body) SELECT 'Church Program', '' WHERE NOT EXISTS (SELECT 1 FROM program_content WHERE id = 1)`;
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

module.exports = { getSql, ensureDatabase };
