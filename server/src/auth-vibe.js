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
  return hash(`ip:${ip}|v6`).slice(0, 16);
}

function passwordHash(password) {
  return hash(`pw:${password}|v6`).slice(0, 48);
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
  if (!raw) return { users: {} };
  try {
    const parsed = JSON.parse(raw);
    return { users: parsed.users || parsed };
  } catch {
    return { users: {} };
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
  let data;
  if (gistId) {
    data = await readGist(gistId);
    if (!data) {
      data = { users: {} };
      gistId = await createGist(data);
      saveGistId(gistId);
    }
  } else {
    data = { users: {} };
    gistId = await createGist(data);
    saveGistId(gistId);
  }
  data.users = data.users || {};
  return { data, gistId };
}

function makeToken(user, username, vibeExtra) {
  const token = signToken(user.id);
  return {
    user: { id: user.id, email: user.email, username },
    token,
    vibe: { method: "vibe", username, ...vibeExtra },
  };
}

async function ensureDbUser(email, pwHash) {
  let user = await findUserByEmail(email);
  if (!user) {
    user = { id: newId("us"), email, passwordHash: "vibe:" + pwHash };
    await createUser(user);
  }
  return user;
}

// ── Public API ──

export async function vibeAuth(username, password, ip) {
  if (!GIST_TOKEN) {
    const err = new Error("Vibe login is not configured on this server.");
    err.statusCode = 501;
    throw err;
  }

  const ipKey = ipHash(ip);
  const { data, gistId } = await ensureGist();
  const email = `vibe:${username.toLowerCase().trim()}`;
  const account = data.users[username];

  // ── Existing account ──
  if (account) {
    const knownIps = account.knownIps || [];

    // Same device → instant login
    if (knownIps.includes(ipKey)) {
      account.lastLogin = new Date().toISOString();
      try { await updateGist(gistId, data); } catch {}

      const user = await ensureDbUser(email, account.passwordHash || "local");
      return makeToken(user, username, { status: "welcome_back", sameDevice: true });
    }

    // Different device → need password
    if (!password) {
      const err = new Error("PASSWORD_REQUIRED");
      err.statusCode = 401;
      err.code = "PASSWORD_REQUIRED";
      throw err;
    }

    const pwHash = passwordHash(password);
    if (account.passwordHash && account.passwordHash !== pwHash) {
      const err = new Error("Wrong password.");
      err.statusCode = 401;
      throw err;
    }

    // Password correct — add this device to known IPs
    account.knownIps = account.knownIps || [];
    if (!account.knownIps.includes(ipKey)) {
      account.knownIps.push(ipKey);
    }
    account.lastLogin = new Date().toISOString();
    try { await updateGist(gistId, data); } catch {}

    const user = await ensureDbUser(email, pwHash);
    return makeToken(user, username, { status: "welcome_back", sameDevice: false });
  }

  // ── New account → REGISTER ──
  if (!password || password.length < 4) {
    const err = new Error("PASSWORD_REQUIRED");
    err.statusCode = 401;
    err.code = "PASSWORD_REQUIRED";
    throw err;
  }

  const pwHash = passwordHash(password);
  data.users[username] = {
    passwordHash: pwHash,
    knownIps: [ipKey],
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  try {
    await updateGist(gistId, data);
  } catch {
    const e = new Error("Could not save your identity. Try again.");
    e.statusCode = 503;
    throw e;
  }

  const user = await ensureDbUser(email, pwHash);
  return makeToken(user, username, { status: "registered", sameDevice: true });
}

export function vibeConfigured() {
  return !!process.env.GITHUB_GIST_TOKEN;
}
