# Features

Complete feature list for SiteAudit. Each feature is tagged with the scan mode it
belongs to:

- **P** = Passive (always available, no verification needed)
- **A** = Active / Full Check (requires ownership verification)

---

## 1. Input & Configuration

| Feature | Mode | Description |
|---------|:----:|-------------|
| URL input | P | Paste any `http(s)://` URL; protocol auto-detected and normalized to HTTPS |
| Crawl depth | P | Home page + all linked pages (default 100, configurable up to 500) |
| Sitemap support | P | Reads `robots.txt` and `sitemap.xml` to discover more pages |
| Scope lock | P | Scanning never leaves the submitted host; optional path prefix scoping |
| Mode selector | P | User picks **Passive** or **Full** (Full requires verification) |
| Test credentials | A | Optional login credentials to scan authenticated areas |
| Re-scan schedule | A | Set a cron-like re-scan for verified targets |

---

## 2. Discovery (Reverse-Engineering Core)

| Feature | Mode | Description |
|---------|:----:|-------------|
| Link crawler | P | Extracts every internal URL from HTML, nav, forms, pagination |
| Source-code fetch | P | Downloads the HTML/CSS/JS source of every discovered page |
| JS analysis | P | Extracts all JS files and lists every fetch/XHR/WebSocket call found |
| API endpoint discovery | P | Aggregates `/api/*`, `/v1/*`, GraphQL queries, and hidden routes found in JS |
| Secret scan | P | Flags hardcoded AWS/GCP/Stripe keys, JWTs, OAuth secrets, DB connection strings |
| Tech fingerprinting | P | Detects CMS, framework, server, and versions via `whatweb` |
| Endpoint status map | P | Live/4xx/5xx status for every discovered endpoint |

---

## 3. Enumeration & Exposed-File Detection

| Feature | Mode | Description |
|---------|:----:|-------------|
| Directory brute-force | P/A | Enumerates common paths: `/admin`, `/wp-admin`, `/backup`, `/dev`, `/staging` |
| Exposed file detection | P | Detects `.git`, `.env`, `.bak`, `.sql`, `config.*`, `phpinfo()`, `*.log`, `/server-status` |
| Backup dump detection | P | Finds database/export dumps left on the server |
| Directory listing check | P | Detects when `Index of /` listing is enabled |
| Deep wordlist | A | Larger, slower wordlists for aggressive enumeration |

---

## 4. Vulnerability Scanning

| Feature | Mode | Description |
|---------|:----:|-------------|
| Known-CVE matching | P | Nuclei templates matched against detected tech/versions |
| Misconfiguration checks | P | Open directories, debug mode, default pages, sample files |
| Exposed services | P | phpMyAdmin, Docker daemons, monitoring dashboards without auth |
| Default credential hints | P | Detects default login pages / known default credentials |
| Security header audit | P | Missing `Content-Security-Policy`, `X-Frame-Options`, `HSTS`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |
| TLS/SSL audit | P | Expired cert, weak cipher config, TLS 1.0/1.1 enabled, missing HTTPS redirect |
| SQL injection | A | `sqlmap` automated testing with non-destructive payloads |
| XSS testing | A | OWASP ZAP active XSS checks |
| SSRF testing | A | Server-side request forgery probes |
| Command injection | A | Payload-based command injection checks |
| Auth bypass probes | A | Check unauthenticated access to protected endpoints |

---

## 5. Deep Source-Code Review

| Feature | Mode | Description |
|---------|:----:|-------------|
| Route cross-reference | P | Matches discovered JS routes against real server responses |
| Dead / leaked routes | P | Flags routes referenced in code that are unexpectedly reachable |
| Hardcoded credential review | P | Finds usernames/passwords/tokens committed in source |
| Open redirect detection | P | Flags redirect parameters accepting attacker-controlled input |
| Sensitive-action exposure | P/A | Detects admin/privileged endpoints reachable without login |
| Info disclosure | P | Internal IPs, stack traces, server banners, emails in HTML/source |
| Dependency check | A | Flags known-vulnerable JS library versions found on the page |

---

## 6. Findings & Fix Suggestions

Every finding carries:

| Field | Description |
|-------|-------------|
| Severity | critical / high / medium / low / info |
| Category | cve / misconfig / endpoint / secret / header / tls / injection / info |
| URL / endpoint | Exact location affected |
| Evidence | The actual snippet, header, or response that triggered it |
| Description | Plain-English explanation |
| Fix | Step-by-step remediation (rule-based, OWASP/WSTG mapped) |
| References | Relevant OWASP, CVE, or documentation links |

---

## 7. Reporting

| Feature | Mode | Description |
|---------|:----:|-------------|
| Security score | P | 0-100 score computed from severity-weighted findings |
| Results dashboard | P | Summary cards, filterable table, severity chart |
| Finding detail view | P | Expand each finding to see evidence + fix |
| Report exports | P | JSON (machine-readable), HTML (shareable), CSV (spreadsheet) |
| Re-scan diff | A | Highlights what changed between two scans of the same target |
| Verification status UI | P | Locked/verified state shown clearly per scan |

---

## 8. Ownership Verification UX

| Feature | Mode | Description |
|---------|:----:|-------------|
| Partial-scan banner | P | Shows "Full Check available — verify ownership" on active findings |
| Get More Details button | P | Opens the verification modal |
| Token file upload | P | Default method; works on any host including `*.vercel.app` |
| Meta tag method | P | Add a `<meta>` tag to the homepage |
| HTTP header method | P | Add a header via `vercel.json` / `netlify.toml` |
| DNS TXT method | P | For custom domains |
| Email method | P | For custom domains (WHOIS/domain inbox) |
| Auto re-verify | A | Stores verified state so repeat scans skip re-verification |

---

## 9. Optional AI Add-On (Free Tier)

| Feature | Mode | Description |
|---------|:----:|-------------|
| Plain-English summary | P | LLM summary of the whole report in simple terms |
| Fix prioritization | P | LLM orders fixes by effort vs. risk |
| Non-technical guidance | P | Explains each finding for site owners without security background |

Implemented with a free LLM provider (Cloudflare Workers AI / Groq / Gemini free tier)
or disabled entirely in favor of rule-based text (default).
