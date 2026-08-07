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

function fingerprint(username) {
  const raw = `${username}|siteaudit-vibe-v4`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function ipHash(ip) {
  return createHash("sha256").update(`ip:${ip}|v4`).digest("hex").slice(0, 16);
}

function getStoredGistId() {
  try {
    if (existsSync(GIST_ID_FILE)) {
      return readFileSync(GIST_ID_FILE, "utf8").trim();
    }
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
    return JSON.parse(raw);
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

export async function vibeLogin(username, ip) {
  if (!GIST_TOKEN) {
    const err = new Error("Vibe login is not configured on this server.");
    err.statusCode = 501;
    throw err;
  }

  const fp = fingerprint(username);
  const email = `vibe:${username.toLowerCase().trim()}`;
  const ipKey = ipHash(ip);
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

  const existingIpUser = gist.ips[ipKey];

  if (existingIpUser) {
    // This IP already has a registered username
    if (existingIpUser === username) {
      // Same IP + same username — login
      // Update last login
      gist.users[username] = gist.users[username] || { fingerprint: fp, createdAt: new Date().toISOString() };
      gist.users[username].lastLogin = new Date().toISOString();
      try { await updateGist(gistId, gist); } catch {}

      let user = await findUserByEmail(email);
      if (!user) {
        user = { id: newId("us"), email, passwordHash: "vibe:" + fp };
        await createUser(user);
      }

      const token = signToken(user.id);
      return {
        user: { id: user.id, email: user.email, username },
        token,
        vibe: { method: "vibe", username, deviceFingerprint: fp.slice(0, 8), isNew: false },
      };
    } else {
      // Same IP + different username — BLOCKED
      const err = new Error(`This device already claimed the username "${existingIpUser}". Use that name to log back in.`);
      err.statusCode = 403;
      throw err;
    }
  }

  // New IP — check if someone else already took this username
  if (gist.users[username]) {
    const err = new Error(`"${username}" is already taken. Pick a different username.`);
    err.statusCode = 409;
    throw err;
  }

  // Register new user for this IP
  gist.ips[ipKey] = username;
  gist.users[username] = {
    fingerprint: fp,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
  try {
    await updateGist(gistId, gist);
  } catch (err) {
    const e = new Error("Could not save your identity. GitHub Gist may be rate-limited. Try again in a moment.");
    e.statusCode = 503;
    throw e;
  }

  let user = await findUserByEmail(email);
  if (!user) {
    user = { id: newId("us"), email, passwordHash: "vibe:" + fp };
    await createUser(user);
  }

  const token = signToken(user.id);
  return {
    user: { id: user.id, email: user.email, username },
    token,
    vibe: { method: "vibe", username, deviceFingerprint: fp.slice(0, 8), isNew: true },
  };
}

export function vibeConfigured() {
  return !!process.env.GITHUB_GIST_TOKEN;
}
