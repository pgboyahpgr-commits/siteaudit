# Reporting & Fix Suggestions

How findings are normalized, how the security score is computed, and how every finding
gets a fix mapped to OWASP / WSTG guidance.

---

## 1. The Finding Schema

Every tool output is normalized into one canonical object:

```json
{
  "id": "fn_11",
  "severity": "high",
  "category": "secret",
  "title": "Hardcoded AWS access key in bundle.js",
  "url": "https://example.com/assets/index.js",
  "evidence": "AKIAIOSFODNN7EXAMPLE",
  "description": "An AWS access key was found embedded in the public JavaScript bundle.",
  "cveId": null,
  "fix": "Revoke the key immediately...",
  "references": ["https://..."],
  "phase": "enumerate",
  "tool": "katana"
}
```

### Severities
`critical` > `high` > `medium` > `low` > `info`

| Severity | Example |
|----------|---------|
| critical | Exposed DB credentials, `.env` publicly readable, RCE-grade CVE |
| high | Hardcoded API key, SQLi, missing auth on admin API |
| medium | Missing CSP, TLS 1.0 enabled, open directory listing |
| low | Missing `X-Frame-Options`, verbose error pages |
| info | Tech stack revealed, version banner, robots.txt paths |

### Categories
`cve` · `misconfig` · `endpoint` · `secret` · `header` · `tls` · `injection` · `info`

---

## 2. Security Score (0-100)

Weighted sum with a ceiling of 100 (higher = better):

```
penalties = sum over findings of weight(severity)
score = clamp(100 - penalties, 0, 100)
```

| Severity | Weight |
|----------|:------:|
| critical | 25 |
| high | 12 |
| medium | 5 |
| low | 2 |
| info | 0.5 |

Rounding: one decimal. The score is shown on the dashboard with a color band:
`0-49` red, `50-79` amber, `80-100` green.

---

## 3. Fix Rules (OWASP / WSTG Mapping)

The `scanner/rules/owasp.js` file maps `(category, severity, finding)` -> remediation
text. Every rule includes concrete steps and at least one reference. Examples:

| Category | Fix rule (abridged) |
|----------|---------------------|
| `secret` | "Rotate/revoke the key, remove it from source, add secret-scanning to CI, move secrets to environment variables or a vault." Ref: OWASP Top 10 A05:2021, AWS key best practices |
| `header` | "Add `Content-Security-Policy`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`." Ref: OWASP Secure Headers Project |
| `cve` | "Upgrade <product> from <v> to <fixed>. Check vendor advisory." Ref: linked CVE page |
| `misconfig` | "Disable directory listing (`Options -Indexes`), remove default/sample files, turn off debug mode." Ref: OWASP WSTG-CONF |
| `endpoint` | "Restrict access to this path with authentication/authorization; remove if unused." Ref: OWASP A01:2021 |
| `tls` | "Disable TLS 1.0/1.1, enforce TLS 1.2+, fix/refresh the certificate, add redirect to HTTPS." Ref: OWASP Transport Layer Protection |
| `injection` | "Use parameterized queries / prepared statements, output-encode, validate input." Ref: OWASP A03:2021, WSTG-INPV |
| `info` | Informational only; no action required or low-priority hardening. |

Rules interpolate real values where available (`{cveId}`, `{url}`, `{version}`,
`{missingHeader}`) so fixes read naturally.

---

## 4. Report Formats

| Format | Use | Generator |
|--------|-----|-----------|
| JSON | Machine-readable, API, re-scan diffing | `scanner/phases/6-report.js` |
| HTML | Shareable human report (single file, inline CSS) | `scanner/report/template.html` |
| CSV | Spreadsheet analysis | same builder |

All reports include: scan metadata (target, date, mode, score), severity summary,
findings table, and per-finding detail with evidence + fix.

---

## 5. Re-Scan Diff

For verified targets, store the previous `report.json`. Diff is computed on:
- New findings (added since last scan)
- Resolved findings (present before, absent now)
- Score change

Diff output feeds the "What changed" section of the report.

---

## 6. Plain-English Summary (Optional AI)

When enabled, an LLM receives the report JSON and returns:
- A 3-5 sentence summary a non-technical owner understands
- A prioritized fix order (effort vs risk)

When disabled, the rule-based fixes are used as-is (default, fully offline).
