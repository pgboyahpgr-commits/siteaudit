# Architecture

This document describes how SiteAudit is designed end-to-end: components, data flow,
data model, and how the pieces talk to each other.

---

## 1. High-Level Diagram

```
+---------------------+   HTTPS   +---------------------------+
|   React Web App     | ---------> |  API Server (Node)        |
|  (Vite, Tailwind)   |            |  - POST /scan            |
|                     |            |  - POST /verify          |
|  ScanForm           |            |  - GET  /scan/:id        |
|  ResultsDashboard   | <--------- |  - GET  /report/:id      |
|  VerificationModal  |   JSON     |  - GET  /findings/:id    |
|  FullCheckButton    |            +------------+--------------+
+---------------------+                         |
                                                | jobs (JSON via queue table)
                                                v
+-------------------------------------+  +-------------------------------+
|  Scan Worker (free VM / Codespace)  |  |  Storage                      |
|  phases/                            |  |  SQLite:                      |
|   1. discovery  (httpx, katana)     |  |   scans, findings, verifications|
|   2. fingerprint(whatweb)           |  |   reports, consent_log        |
|   3. enumerate  (gobuster, katana)  |  +-------------------------------+
|   4. vuln      (nuclei)             |
|   5. active    (zap, sqlmap) -- GATED |
|   6. report    (builder + fix rules)|
+-------------------------------------+
```

---

## 2. Components

### 2.1 Web Frontend (`web/`)
A single-page React application.

**Routes**
- `/` — landing + scan form
- `/scan/:id` — live scan progress + results dashboard
- `/report/:id` — full report view + export buttons
- `/docs` — generated documentation pages

**Key components**
- `ScanForm` — URL input, depth selector, mode selector, consent checkbox, scope
  limits, optional test-credentials field (Full Check only).
- `ResultsDashboard` — severity summary cards, filterable findings table, security
  score gauge, per-finding expandable details.
- `VerificationModal` — walks the user through the chosen ownership-proof method
  (token file, meta tag, header, DNS, email) and polls `/verify`.
- `FullCheckButton` — enabled only when the scan is verified; launches the active phase.
- `ReportExporter` — download buttons for JSON, HTML, and CSV.

**API client** — a thin `fetch` wrapper in `web/src/api/` with typed responses matching
the schema in [API.md](API.md).

### 2.2 API Server (`server/`)
A Node.js + Fastify application exposing a REST API. Responsibilities:

- Validate incoming scan requests (URL normalization, scope rules, consent).
- Persist scan jobs and status in SQLite.
- Queue jobs for the worker and track lifecycle:
  `queued -> running -> completed | failed`.
- Handle ownership verification challenges and validation.
- Serve scan results and reports.
- Enforce rate limits and log consent.

**Suggested module layout**
```
server/src/
  index.ts            # Fastify bootstrap
  routes/
    scan.ts           # POST /scan, GET /scan/:id, POST /scan/:id/full
    verify.ts         # POST /verify/challenge, POST /verify/check
    report.ts         # GET /report/:id, GET /report/:id/export
  queue/
    queue.ts          # job queue (SQLite-backed)
    worker.ts         # pulls jobs, invokes scanner CLI, updates status
  db/
    schema.sql        # tables: scans, findings, verifications, consent_log, reports
    migrations.ts
  middleware/
    rateLimit.ts
    consent.ts
  lib/
    validate.ts       # URL normalization + scope checks
    verify.ts         # token generation + challenge validation
```

### 2.3 Scan Worker (`scanner/`)
A standalone Node process (or set of shell scripts) that:

1. Polls the job queue (or reads a job file) for a target + mode.
2. Runs the phases in order, writing raw tool output under `scanner/out/<scanId>/`.
3. Normalizes all findings into the canonical finding schema.
4. Runs the fix-rule engine to attach remediation guidance to each finding.
5. Writes the final report JSON and notifies the server.

**Phase runners**
```
scanner/
  cli.js              # entrypoint: node scanner/cli.js --url X --mode Y
  phases/
    1-discovery.js    # httpx + katana -> endpoints, tech, source
    2-fingerprint.js  # whatweb -> versions -> CVE template selection
    3-enumerate.js    # gobuster + katana grep -> exposed files/secrets
    4-vuln.js         # nuclei -tags focused by fingerprint
    5-active.js       # zap / sqlmap (GATED by verification)
    6-report.js       # normalize + fix rules + scoring
  tools/
    httpx.js  katana.js  whatweb.js  gobuster.js
    nuclei.js  zap.js  sqlmap.js
  rules/
    owasp.js          # finding.type -> fix text, references
  out/                # per-scan raw output + reports
```

---

## 3. Data Flow

### 3.1 Passive Scan Lifecycle
```
User submits URL
   -> server validates + persists scan row (status=queued, mode=passive)
   -> server enqueues job
   -> worker picks up job
   -> discovery -> fingerprint -> enumerate -> vuln (nuclei)
   -> report builder normalizes findings + attaches fixes
   -> worker posts results back -> server marks scan completed
   -> frontend polls GET /scan/:id and renders dashboard
```

### 3.2 Verification Flow
```
User clicks "Get More Details / Verify Ownership"
   -> POST /verify/challenge  {url, method: 'file'|'meta'|'header'|'dns'|'email'}
   -> server generates token, persists verification row (status=pending)
   -> UI shows exact instructions + the token
   -> user places token (upload file / meta tag / header / TXT / clicks email link)
   -> UI polls POST /verify/check {url, method, token}
   -> server fetches the token location and compares
   -> on success: verification.status = verified; scan.verified = true
   -> FullCheckButton unlocks
```

### 3.3 Full Check Lifecycle
Same as passive, but with mode=full. Runs `5-active.js` (ZAP / sqlmap) only if
`scan.verified === true`. Any attempt to enqueue a full scan without verification is
rejected by the server with `403`.

---

## 4. Data Model (SQLite)

```sql
CREATE TABLE scans (
  id           TEXT PRIMARY KEY,
  target_url   TEXT NOT NULL,
  host         TEXT NOT NULL,
  mode         TEXT NOT NULL CHECK (mode IN ('passive','full')),
  status       TEXT NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued','running','completed','failed','cancelled')),
  verified     INTEGER NOT NULL DEFAULT 0,
  consent_ts   TEXT NOT NULL,
  verifier_ip  TEXT NOT NULL,
  scope_regex  TEXT NOT NULL,
  score        INTEGER,               -- 0..100 security score
  created_at   TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE findings (
  id           TEXT PRIMARY KEY,
  scan_id      TEXT NOT NULL REFERENCES scans(id),
  severity     TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  category     TEXT NOT NULL,         -- cve, misconfig, endpoint, secret, header, tls, injection, info
  title        TEXT NOT NULL,
  url          TEXT,
  evidence     TEXT,                  -- snippet / header / raw response
  description  TEXT,
  cve_id       TEXT,
  fix          TEXT,                  -- human remediation steps
  references   TEXT,                  -- JSON array of links
  created_at   TEXT NOT NULL
);

CREATE TABLE verifications (
  id          TEXT PRIMARY KEY,
  scan_id     TEXT NOT NULL REFERENCES scans(id),
  method      TEXT NOT NULL,          -- file | meta | header | dns | email
  token       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','verified','failed','expired')),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  verified_at TEXT
);

CREATE TABLE consent_log (
  id          TEXT PRIMARY KEY,
  scan_id     TEXT,
  target_url  TEXT NOT NULL,
  agreed      INTEGER NOT NULL,
  verifier_ip TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE reports (
  id         TEXT PRIMARY KEY,
  scan_id    TEXT NOT NULL REFERENCES scans(id),
  format     TEXT NOT NULL,           -- json | html | csv
  path       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

---

## 5. Concurrency & Scalability (for a $0 budget)

- **Single worker**: the queue is SQLite-backed; one worker consumes jobs sequentially.
  Good enough for hundreds of scans per day.
- **Multiple workers**: run more Codespaces/VMs pointed at the same database via
  `DATABASE_URL` (SQLite file shared via a sync tool, or swap SQLite for Turso/Cloudflare
  D1 free tier later).
- **Scheduled re-scans**: GitHub Actions cron job hits the internal endpoint
  `POST /scan/reschedule` with saved verified targets.

---

## 6. Security Design

- All scanning outbound from the worker is scope-limited to the submitted host.
- Rate limiting per IP and per target on the server.
- Full Check (active) is gated by a `verified` flag that can only be set after a
  successful ownership challenge.
- Tokens are random 128-bit values, stored hashed (SHA-256), with expiry.
- Consent records stored for every scan (URL, timestamp, IP).
- No secrets in client code; server reads environment variables.

See [SECURITY-LEGAL.md](SECURITY-LEGAL.md) for the full model.

---

## 7. Failure Handling

| Failure | Handling |
|---------|----------|
| Target down / DNS failure | Mark scan `failed`, return friendly error |
| Tool not installed | Phase runner logs, marks scan `failed`, instructs user to run `install-tools` |
| Timeout (per phase) | Phase has a hard timeout, kills child process, continues to next phase |
| Verification token expired | Mark `expired`, user requests a new challenge |
| Rate limit hit on target | Respect target `Retry-After`, slow pacing, log |
