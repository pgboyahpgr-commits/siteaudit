import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createUser, findUserByEmail } from "./db.js";
import { newId } from "./store.js";
import { signToken } from "./auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "..", "data");
const GIST_ID_FILE = join(DATA_DIR, "vibe_gist_id.txt");
const GIST_TOKEN = process.env.GITHUB_GIST_TOKEN;

const GIST_DESC = "SiteAudit VibeAuth — device-linked identities";
const GIST_FILENAME = "vibe_users.json";

function hash(str) {
  return createHash("sha256").update(str).digest("hex");
}

function ipHash(ip) {
  return hash(`ip:${ip}|v5`).slice(0, 16);
}

function passwordHash(password) {
  return hash(`pw:${password}|v5`).slice(0, 48);
}

// ── Gist helpers ──

function getStoredGistId() {
  try {
    if (existsSync(GIST_ID_FILE)) return readFileSync(GIST_ID_FILE, "utf8").trim();
  } catch {}
  return null;
}

function saveGistId(gistId) {
  writeFileSync(GIST_ID_FILE, gistId, "utf8");
}

async function createGist(content) {
  const res = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      authorization: `Bearer ${GIST_TOKEN}`,
      "content-type": "application/json",
      accept: "application/vnd.github+json",
      "user-agent": "SiteAudit",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      description: GIST_DESC,
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify(content, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`GitHub create gist failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function readGist(gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      authorization: `Bearer ${GIST_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "SiteAudit",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub read gist failed: ${res.status}`);
  }
  const data = await res.json();
  const raw = data.files?.[GIST_FILENAME]?.content;
  if (!raw) return { users: {}, ips: {} };
  try {
    return JSON.parse(raw);
  } catch {
    return { users: {}, ips: {} };
  }
}

async function updateGist(gistId, content) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${GIST_TOKEN}`,
      "content-type": "application/json",
      accept: "application/vnd.github+json",
      "user-agent": "SiteAudit",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      description: GIST_DESC,
      files: { [GIST_FILENAME]: { content: JSON.stringify(content, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`GitHub update gist failed: ${res.status}`);
}

async function ensureGist() {
  let gistId = getStoredGistId();
  let gist;
  if (gistId) {
    gist = await readGist(gistId);
    if (!gist) {
      gist = { users: {}, ips: {} };
      gistId = await createGist(gist);
      saveGistId(gistId);
    }
  } else {
    gist = { users: {}, ips: {} };
    gistId = await createGist(gist);
    saveGistId(gistId);
  }
  gist.ips = gist.ips || {};
  gist.users = gist.users || {};
  return { gist, gistId };
}

function makeToken(user, username, vibeExtra) {
  const token = signToken(user.id);
  return {
    user: { id: user.id, email: user.email, username },
    token,
    vibe: { method: "vibe", username, ...vibeExtra },
  };
}

// ── Public API ──

export async function vibeAuth(username, password, ip) {
  if (!GIST_TOKEN) {
    const err = new Error("Vibe login is not configured on this server.");
    err.statusCode = 501;
    throw err;
  }

  const ipKey = ipHash(ip);
  const { gist, gistId } = await ensureGist();
  const email = `vibe:${username.toLowerCase().trim()}`;
  const existingIpUser = gist.ips[ipKey];
  const existingUser = gist.users[username];

  // ── CASE 1: This IP already owns a different username ──
  if (existingIpUser && existingIpUser !== username) {
    const err = new Error(`This device is linked to "${existingIpUser}". Use that username instead.`);
    err.statusCode = 403;
    throw err;
  }

  // ── CASE 2: User exists, SAME IP → instant login (no password needed) ──
  if (existingIpUser === username && existingUser) {
    gist.users[username].lastLogin = new Date().toISOString();
    try { await updateGist(gistId, gist); } catch {}

    let user = await findUserByEmail(email);
    if (!user) {
      user = { id: newId("us"), email, passwordHash: "vibe:local" };
      await createUser(user);
    }
    return makeToken(user, username, { status: "welcome_back", sameDevice: true });
  }

  // ── CASE 3: User exists, DIFFERENT IP → need password ──
  if (existingUser && !existingIpUser) {
    if (!password) {
      const err = new Error("PASSWORD_REQUIRED");
      err.statusCode = 401;
      err.code = "PASSWORD_REQUIRED";
      throw err;
    }
    const pwHash = passwordHash(password);
    if (existingUser.passwordHash !== pwHash) {
      const err = new Error("Wrong password.");
      err.statusCode = 401;
      throw err;
    }
    // Password correct — log in from new device
    gist.users[username].lastLogin = new Date().toISOString();
    try { await updateGist(gistId, gist); } catch {}

    let user = await findUserByEmail(email);
    if (!user) {
      user = { id: newId("us"), email, passwordHash: "vibe:" + pwHash };
      await createUser(user);
    }
    return makeToken(user, username, { status: "welcome_back", sameDevice: false });
  }

  // ── CASE 4: New username → REGISTER (password required) ──
  if (!existingUser) {
    if (!password || password.length < 4) {
      const err = new Error("Password is required to register (min 4 characters).");
      err.statusCode = 400;
      throw err;
    }

    const pwHash = passwordHash(password);
    gist.ips[ipKey] = username;
    gist.users[username] = {
      passwordHash: pwHash,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    try {
      await updateGist(gistId, gist);
    } catch {
      const e = new Error("Could not save your identity. Try again.");
      e.statusCode = 503;
      throw e;
    }

    let user = await findUserByEmail(email);
    if (!user) {
      user = { id: newId("us"), email, passwordHash: "vibe:" + pwHash };
      await createUser(user);
    }

    return makeToken(user, username, { status: "registered", sameDevice: true });
  }

  // Should never reach here
  const err = new Error("Unexpected auth state. Try again.");
  err.statusCode = 500;
  throw err;
}

export function vibeConfigured() {
  return !!process.env.GITHUB_GIST_TOKEN;
}
