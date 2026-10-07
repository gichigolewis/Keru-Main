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
      await query`CREATE TABLE IF NOT EXISTS members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(80) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
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
        content VARCHAR(700) NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('Faith', 'Life', 'Service')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await query`CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON community_posts(created_at DESC)`;
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
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

module.exports = { getSql, ensureDatabase };
