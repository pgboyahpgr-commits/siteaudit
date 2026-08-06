import pg from "pg";

const { Pool } = pg;

const SCHEMA_SQL = `
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
`;

// Supabase free-tier Postgres. Connection is lazy: no query runs until first use.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000,
});

let ensured = null;
function ensure() {
  if (!ensured) ensured = pool.query(SCHEMA_SQL).then(() => true);
  return ensured;
}

async function run(sql, params = []) {
  await ensure();
  const res = await pool.query(sql, params);
  return res;
}

export async function createUser({ id, email, passwordHash }) {
  await run("INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)", [
    id,
    email,
    passwordHash,
    new Date().toISOString(),
  ]);
}

export async function findUserByEmail(email) {
  const res = await run("SELECT id, email, password_hash, created_at FROM users WHERE email = $1", [email]);
  return res.rows[0] || null;
}

export async function findUserById(id) {
  const res = await run("SELECT id, email, created_at FROM users WHERE id = $1", [id]);
  return res.rows[0] || null;
}

export async function upsertScan(scan) {
  await run(
    `INSERT INTO scans (id, user_id, target_url, mode, status, score, verified, created_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       score = EXCLUDED.score,
       verified = EXCLUDED.verified,
       completed_at = EXCLUDED.completed_at,
       user_id = EXCLUDED.user_id`,
    [
      scan.id,
      scan.userId || null,
      scan.targetUrl,
      scan.mode,
      scan.status,
      scan.score ?? null,
      scan.verified ? 1 : 0,
      scan.createdAt,
      scan.completedAt,
    ]
  );
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

export async function listUserScans(userId, limit = 50) {
  const res = await run(
    `SELECT id, target_url, mode, status, score, verified, created_at, completed_at
     FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return res.rows.map(rowToScan);
}

export async function saveChatMessage({ id, scanId, role, content }) {
  await run("INSERT INTO chat_messages (id, scan_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)", [
    id,
    scanId,
    role,
    content,
    new Date().toISOString(),
  ]);
}

export async function listChatMessages(scanId, limit = 30) {
  const res = await run(
    "SELECT id, role, content, created_at FROM chat_messages WHERE scan_id = $1 ORDER BY created_at ASC LIMIT $2",
    [scanId, limit]
  );
  return res.rows;
}
