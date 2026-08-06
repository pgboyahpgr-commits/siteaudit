import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "..", "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, "siteaudit.db"));

db.exec(`
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
`);

export function upsertScan(scan) {
  const stmt = db.prepare(`
    INSERT INTO scans (id, user_id, target_url, mode, status, score, verified, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status, score=excluded.score, verified=excluded.verified, completed_at=excluded.completed_at
  `);
  stmt.run(
    scan.id,
    scan.userId || null,
    scan.targetUrl,
    scan.mode,
    scan.status,
    scan.score ?? null,
    scan.verified ? 1 : 0,
    scan.createdAt,
    scan.completedAt
  );
}

export function listUserScans(userId, limit = 50) {
  const stmt = db.prepare(
    `SELECT id, target_url, mode, status, score, verified, created_at, completed_at
     FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
  );
  return stmt.all(userId, limit).map(rowToScan);
}

function rowToScan(r) {
  return {
    scanId: r.id,
    targetUrl: r.target_url,
    mode: r.mode,
    status: r.status,
    score: r.score,
    verified: !!r.verified,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

export function createUser({ id, email, passwordHash }) {
  db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    email,
    passwordHash,
    new Date().toISOString()
  );
}

export function findUserByEmail(email) {
  return db.prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?").get(email);
}

export function findUserById(id) {
  return db.prepare("SELECT id, email, created_at FROM users WHERE id = ?").get(id);
}

export function saveChatMessage({ id, scanId, role, content }) {
  db.prepare("INSERT INTO chat_messages (id, scan_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    scanId,
    role,
    content,
    new Date().toISOString()
  );
}

export function listChatMessages(scanId, limit = 30) {
  return db
    .prepare("SELECT id, role, content, created_at FROM chat_messages WHERE scan_id = ? ORDER BY created_at ASC LIMIT ?")
    .all(scanId, limit);
}
