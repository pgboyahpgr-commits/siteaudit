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

function fingerprint(ip, username) {
  const raw = `${username}|siteaudit-vibe-v3`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
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

  const fp = fingerprint(ip, username);
  const email = `vibe:${username.toLowerCase().trim()}`;
  let gistId = getStoredGistId();

  // Read or create the gist
  let gist;
  if (gistId) {
    gist = await readGist(gistId);
    if (!gist) {
      // Gist was deleted, create a new one
      gist = { users: {} };
      gistId = await createGist(gist);
      saveGistId(gistId);
    }
  } else {
    gist = { users: {} };
    gistId = await createGist(gist);
    saveGistId(gistId);
  }

  // Check if username exists in gist
  const existing = gist.users?.[username];
  if (existing) {
    // Update fingerprint if device changed (cross-device support)
    if (existing.fingerprint !== fp) {
      gist.users[username].fingerprint = fp;
      try { await updateGist(gistId, gist); } catch {}
    }
    // Returning user
  } else {
    // New user — add to gist
    gist.users = gist.users || {};
    gist.users[username] = {
      fingerprint: fp,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    try {
      await updateGist(gistId, gist);
    } catch (err) {
      const e = new Error(`Could not save your identity. GitHub Gist may be rate-limited. Try again in a moment.`);
      e.statusCode = 503;
      throw e;
    }
  }

  // Ensure a DB user record exists (needed for JWT + scan ownership)
  let user = await findUserByEmail(email);
  if (!user) {
    user = { id: newId("us"), email, passwordHash: "vibe:" + fp };
    await createUser(user);
  } else {
    // Update last login on gist
    if (gist.users?.[username]) {
      gist.users[username].lastLogin = new Date().toISOString();
      try {
        await updateGist(gistId, gist);
      } catch {}
    }
  }

  const token = signToken(user.id);
  return {
    user: { id: user.id, email: user.email, username },
    token,
    vibe: {
      method: "vibe",
      username,
      deviceFingerprint: fp.slice(0, 8),
      isNew: !existing,
    },
  };
}

export function vibeConfigured() {
  return !!process.env.GITHUB_GIST_TOKEN;
}
