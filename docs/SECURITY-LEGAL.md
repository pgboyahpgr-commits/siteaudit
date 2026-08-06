# Security & Legal Model

SiteAudit is a scanning tool. Scanning a website you do not own, or without written
permission, is **illegal** in most jurisdictions (Computer Fraud and Abuse Act in the
US, GDPR / Computer Misuse Act in the UK/EU, and similar laws worldwide). This is not a
legal opinion — it is the operating rule of the product. We enforce it in software so
the product is safe to offer publicly.

---

## 1. The Rule

- **Passive scanning** (reads, no exploitation): allowed only with an explicit consent
  checkbox at scan time, which we record.
- **Active scanning** (payloads, exploitation): allowed only after the user proves they
  own or control the target site via an ownership challenge.

Unauthorized scans are rejected, not just discouraged.

---

## 2. Enforcement in Software

| Control | Where | Behavior |
|---------|-------|----------|
| Consent checkbox | Frontend + server | Scan is rejected (`400`) unless `consent.agreed === true` |
| Consent log | SQLite `consent_log` | URL + timestamp + verifier IP + UA recorded per scan |
| Ownership gate | Server `verified` flag | `mode: "full"` returns `403` unless `verified` |
| Scope lock | Worker | Requests only ever go to the submitted host (regex enforced) |
| Rate limiting | Server | Per-IP and per-target limits (see API.md) |
| Target pacing | Worker | Max ~5 req/s, honors `Retry-After` — avoids harming the target |
| Timeouts | Worker | Hard per-phase timeouts kill child processes |

---

## 3. What "Verified" Means

`scan.verified` can only become `true` after a successful ownership challenge where the
server **fetches the token from the target itself** and matches it. Methods:

1. Token file at `/.well-known/siteaudit-verify.txt`
2. `<meta name="siteaudit-verification" content="TOKEN">` in the homepage HTML
3. `X-SiteAudit-Token: TOKEN` response header
4. DNS TXT record (`siteaudit-verify=TOKEN`) — custom domains only
5. Email code to the domain/WHOIS inbox — custom domains only

Full details: [VERIFICATION.md](VERIFICATION.md).

---

## 4. Safe-by-Default Scanning

Even for verified owners, the Full Check is deliberately non-destructive:

- **No data deletion or modification** payloads.
- **No heavy DoS-style fuzzing**.
- Injection tests use safe, reversible payloads and timeouts.
- Scope is locked to the verified host and optional path prefix.
- The scanner honors `robots.txt` when `hostOnly` default config is used and never
  follows off-host redirects.

---

## 5. Data Handling

| Data | Handling |
|------|----------|
| Scan targets | Stored only as submitted; tied to the user's scan |
| Consent records | Stored permanently (legal audit trail) |
| Tokens | Generated 128-bit random, stored SHA-256 hashed, 1-hour expiry |
| Test credentials (Full Check) | Used only in the worker session; **not** persisted, masked in logs |
| Secrets found during scans | Displayed in the report, never logged server-side |
| Reports | Stored per scan; user can delete via `DELETE /scan/:id` (admin-gated) |

---

## 6. Abuse Countermeasures

- Per-IP scan quotas prevent using SiteAudit as a free mass-scanning service.
- Active mode requires per-target ownership proof; mass-verification is impractical.
- Rate limits + `robots.txt`-aware crawling prevent accidental target damage.
- An optional honeypot/detection page can be offered to owners so they can detect
  SiteAudit scans on their sites.

---

## 7. Terms-of-Service Placeholder

A `Terms & Acceptable Use` page must state:

- You will only scan sites you own or have explicit written permission to test.
- You are responsible for complying with all applicable laws.
- SiteAudit provides findings "as-is" and is not a substitute for professional
  penetration testing.
- SiteAudit may refuse or cancel any scan at any time.

This page is part of the website build (Phase 3).

---

## 8. Operator Responsibilities

- Do not remove the consent or verification gates "for convenience".
- Keep the tool versions current (Nuclei templates update weekly).
- Add a clear report disclaimer: findings can produce false positives; verify before
  acting on them.

---

## 9. Disclaimer

SiteAudit is a scanning tool that finds potential issues. A finding is not proof of
exploitation, and absence of findings is not proof of security. Always verify findings
manually and treat results as advisory.
