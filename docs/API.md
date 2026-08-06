# API Reference

Base URL (local dev): `http://localhost:4000`

All responses are JSON. Errors follow:
```json
{ "error": { "code": "INVALID_TARGET", "message": "..." } }
```

---

## POST /scan

Create a new scan.

**Body**
```json
{
  "url": "https://example.com",
  "mode": "passive",
  "crawlDepth": 100,
  "scope": { "hostOnly": true, "pathPrefix": "/app" },
  "consent": { "agreed": true, "statement": "I own this site or have written permission to test it." },
  "credentials": { "username": "...", "password": "..." }
}
```

- `mode`: `passive` (default) or `full` (requires verified ownership).
- `credentials` only accepted when `mode === "full"`.
- `consent.agreed` must be `true`; server records `verifier_ip` + timestamp.

**Responses**
- `201 Created`
```json
{
  "scanId": "sc_8f3a",
  "status": "queued",
  "targetUrl": "https://example.com",
  "mode": "passive",
  "createdAt": "2026-08-06T10:00:00Z"
}
```
- `400` invalid URL / missing consent
- `403` `mode: "full"` without verified ownership

---

## GET /scan/:id

Poll scan status and (when complete) results summary.

**Response**
```json
{
  "scanId": "sc_8f3a",
  "targetUrl": "https://example.com",
  "mode": "passive",
  "status": "running",
  "progress": {
    "phase": "vuln",
    "phaseIndex": 3,
    "phasesTotal": 4,
    "phaseProgressPct": 62
  },
  "verified": false,
  "score": null,
  "findingsSummary": { "critical": 0, "high": 2, "medium": 5, "low": 3, "info": 4 }
}
```

On `completed`, `score` is populated and `findingsSummary` is final. Full finding
details come from `GET /scan/:id/findings`.

---

## GET /scan/:id/findings

Paginated list of findings with full detail.

**Query params**: `severity`, `category`, `limit` (default 50), `offset`

**Response**
```json
{
  "total": 14,
  "findings": [
    {
      "id": "fn_11",
      "severity": "high",
      "category": "secret",
      "title": "Hardcoded AWS access key in bundle.js",
      "url": "https://example.com/assets/index.js",
      "evidence": "AKIAIOSFODNN7EXAMPLE",
      "description": "An AWS access key was found embedded in the public JavaScript bundle.",
      "cveId": null,
      "fix": "Revoke the key immediately, rotate it, and move it to environment variables. Scan your git history for the same key.",
      "references": ["https://owasp.org/www-project-top-ten/", "https://docs.aws.amazon.com/general/latest/gr/aws-access-keys-best-practices.html"]
    }
  ]
}
```

---

## POST /verify/challenge

Start an ownership verification challenge.

**Body**
```json
{
  "scanId": "sc_8f3a",
  "method": "file"
}
```

`method`: `file` | `meta` | `header` | `dns` | `cname` | `email`

For `email`, the response includes `deliveredTo` and a 6-digit `token`; the email also
contains a magic link to `GET /verify/confirm?v=<verificationId>&c=<code>` which marks the
scan verified server-side.

**Response**
```json
{
  "verificationId": "vf_ab12",
  "token": "SA3f9d2c1e8a4b0f6",
  "instructions": {
    "method": "file",
    "steps": [
      "Create a folder named .well-known in your site root.",
      "Upload a file named siteaudit-verify.txt containing exactly: SA3f9d2c1e8a4b0f6",
      "Ensure https://example.com/.well-known/siteaudit-verify.txt returns the token.",
      "Wait for the site to redeploy (Vercel/Netlify redeploy automatically)."
    ],
    "expectedUrl": "https://example.com/.well-known/siteaudit-verify.txt"
  },
  "expiresAt": "2026-08-06T11:00:00Z"
}
```

---

## POST /verify/check

Validate that the token is now live on the target.

**Body**
```json
{
  "verificationId": "vf_ab12",
  "token": "SA3f9d2c1e8a4b0f6"
}
```

**Response**
```json
{
  "verificationId": "vf_ab12",
  "status": "verified",
  "method": "file",
  "verifiedAt": "2026-08-06T10:12:00Z"
}
```

Possible `status`: `pending`, `verified`, `failed`, `expired`.

---

## POST /scan/:id/full

Upgrade a completed passive scan to a Full Check. Requires the scan to be `verified`.

**Body**
```json
{ "mode": "full" }
```

**Responses**
- `202 Accepted` — new full scan row returned
- `403` — not verified

---

## GET /report/:id

Report metadata.

```json
{
  "reportId": "rp_01",
  "scanId": "sc_8f3a",
  "score": 67,
  "generatedAt": "2026-08-06T10:30:00Z",
  "formats": ["json", "html", "csv"]
}
```

---

## GET /report/:id/export?format=html

Streams the report file. `format`: `json` | `html` | `csv`.

---

## POST /scan/reschedule

Internal endpoint (auth required) used by the scheduled re-scan cron. Accepts a list of
verified scan IDs.

---

## Internal worker endpoints

These are used by the scanner worker, not the public API:

- `POST /internal/jobs/claim` — claim next queued job
- `POST /internal/jobs/:id/complete` — post findings + report path
- `POST /internal/jobs/:id/fail` — record failure

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/scan` | 15 scans/hour/IP (loopback exempt) |
| `/verify/check` | 10 checks/hour/IP (loopback exempt) |
| Worker-to-target pacing | Respect `Retry-After`, max ~5 req/s per target |

## Other endpoints

- `GET /verify/config` — returns the list of verification methods available on this
  instance (email is shown only when a mail provider is configured).
- `GET /verify/confirm?v=..&c=..` — email magic-link confirmation page.

## Authentication

Public endpoints are unauthenticated but heavily rate-limited and consent-logged.
Internal endpoints (`/internal/*`, `/scan/reschedule`) require
`Authorization: Bearer <INTERNAL_API_KEY>` from env.
