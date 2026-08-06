-- SiteAudit — Supabase (PostgreSQL) schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query), or the
-- server creates it automatically on first query when DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  target_url TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER,
  verified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_scan ON chat_messages(scan_id);