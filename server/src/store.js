import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertScan } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "..", "data");
const SCANS_DIR = join(DATA_DIR, "scans");
const REPORTS_DIR = join(DATA_DIR, "reports");

for (const d of [DATA_DIR, SCANS_DIR, REPORTS_DIR]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function readJson(path, fallback = null) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2));
}

export function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function genToken(bytes = 8) {
  return `SA${randomBytes(bytes).toString("hex").toUpperCase()}`;
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

// ---- Scans ----
export function createScan(data) {
  const scan = {
    id: newId("sc"),
    status: "queued",
    progress: { phase: "queued", phaseIndex: 0, phasesTotal: 8, message: "Queued..." },
    findings: [],
    score: null,
    verified: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...data,
  };
  writeJson(join(SCANS_DIR, `${scan.id}.json`), scan);
  upsertScan(scan);
  return scan;
}

export function getScan(id) {
  const fromFile = readJson(join(SCANS_DIR, `${id}.json`));
  return fromFile;
}

export async function getScanRobust(id) {
  const fromFile = readJson(join(SCANS_DIR, `${id}.json`));
  if (fromFile) return fromFile;
  try {
    const { getScanData } = await import("./db.js");
    const fromDb = await getScanData(id);
    if (fromDb) return fromDb;
  } catch {}
  return null;
}

export function updateScan(id, patch) {
  const scan = getScan(id);
  if (!scan) return null;
  const next = { ...scan, ...patch };
  writeJson(join(SCANS_DIR, `${id}.json`), next);
  upsertScan(next);
  return next;
}

export function setScanFindings(id, findings, score) {
  const scan = getScan(id);
  const totalPhases = scan?.mode === "full" ? 9 : 8;
  return updateScan(id, {
    findings,
    score,
    status: "completed",
    completedAt: new Date().toISOString(),
    progress: { phase: "done", phaseIndex: totalPhases, phasesTotal: totalPhases, message: "Scan complete." },
  });
}

export function listScans() {
  const out = [];
  for (const f of readdirSync(SCANS_DIR)) {
    if (f.endsWith(".json")) out.push(readJson(join(SCANS_DIR, f)));
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

// ---- Reports ----
export function saveReport(scanId, formats) {
  const scan = getScan(scanId);
  if (!scan) return null;
  const report = {
    reportId: newId("rp"),
    scanId,
    targetUrl: scan.targetUrl,
    mode: scan.mode,
    score: scan.score,
    findings: scan.findings,
    generatedAt: new Date().toISOString(),
    formats,
  };
  writeJson(join(REPORTS_DIR, `${report.reportId}.json`), report);
  return report;
}

export function getReport(reportId) {
  return readJson(join(REPORTS_DIR, `${reportId}.json`));
}

// ---- Verifications ----
export function createVerification({ scanId, method, token, targetUrl }) {
  const v = {
    id: newId("vf"),
    scanId,
    method,
    targetUrl,
    tokenHash: hashToken(token),
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    verifiedAt: null,
  };
  writeJson(join(DATA_DIR, `verification_${v.id}.json`), v);
  return v;
}

export function getVerification(id) {
  return readJson(join(DATA_DIR, `verification_${id}.json`));
}

export function updateVerification(id, patch) {
  const v = getVerification(id);
  if (!v) return null;
  const next = { ...v, ...patch };
  writeJson(join(DATA_DIR, `verification_${id}.json`), next);
  return next;
}

// ---- Consent log (append-only) ----
export function logConsent(entry) {
  appendFileSync(
    join(DATA_DIR, "consent.log"),
    `${new Date().toISOString()} ${entry.ip} ${entry.url} mode=${entry.mode} agreed=${entry.agreed}\n`
  );
}
