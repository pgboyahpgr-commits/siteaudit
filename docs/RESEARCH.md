# Research Log — Open-Source Inspiration Adopted

How SiteAudit's scanner was inspired by (and extends) existing free/open-source security
tooling. Every idea below is implemented in `server/src/scan/`.

---

## 1. Ownership Verification — Google Search Console model

**Source:** Google Search Console domain-verification docs (token file upload, HTML meta
tag, DNS TXT/CNAME, email).

**Adopted:**
- **Token file upload** at `/.well-known/siteaudit-verify.txt` — works on `*.vercel.app`,
  `*.netlify.app`, `*.pages.dev`, i.e. 100% of vibe-coded free-tier deployments.
- **HTML meta tag** (`<meta name="siteaudit-verification" content="...">`).
- **HTTP response header** (`X-SiteAudit-Token`) — a GSC-style extra that fits serverless
  hosts via `vercel.json` / `netlify.toml`.
- **DNS TXT + CNAME** records under `_siteaudit.<host>`, validated via DoH
  (Cloudflare's `cloudflare-dns.com/dns-query`) so the API needs no DNS privileges.
- **Email code + magic link** when a mail provider is configured.

**Extension over GSC:** token is stored only as a SHA-256 hash, auto-polling UI re-checks
every 8s, and verification gates the active Full Check in software (the legal gate).

## 2. Header security audit — Corsair (trustedsec/Corsair)

**Source:** Corsair — rates security headers, looks for missing/misconfigured ones.

**Adopted:**
- Required header audit: Content-Security-Policy, Strict-Transport-Security,
  X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Advanced (modern) headers:** Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy,
  Origin-Agent-Cluster.
- **CSP weakness analysis** — flags `'unsafe-inline'`, `'unsafe-eval'`, wildcard
  `default-src`.

## 3. HTTP method probing — Wapiti, OWASP ZAP

**Source:** Wapiti checks which HTTP methods are allowed on endpoints; ZAP's
"Server Header Information" / method checks.

**Adopted:**
- `OPTIONS` probe on the origin; flags `PUT`/`DELETE`/`PATCH`/`TRACE`/`CONNECT` when
  advertised in the `Allow` header.

## 4. Subdomain enumeration — crt.sh (certificate transparency)

**Source:** crt.sh public CT-log search; used by many recon tools (Amass, subfinder).

**Adopted:**
- Passive `crt.sh` query for `%.<host>` → lists subdomains as an info finding. Free,
  no API key, real reverse-engineering value (each subdomain is new attack surface).

## 5. Exposed-path & backup probing — gobuster/dirsearch wordlists

**Source:** dirsearch/goBuster wordlist philosophy + Metasploit web scanner modules.

**Adopted:**
- ~90-path wordlist: `.env`, `.git/*`, `wp-config.php*`, SQL dumps, `phpinfo.php`,
  Spring Actuator, swagger/OpenAPI, GraphiQL, admin panels, CI configs, source maps.
- Soft-404 detection to filter SPA catch-all pages (Metasploit-style false-positive
  reduction).

## 6. Source-review passes — gitleaks + Semgrep style

**Source:** gitleaks (secrets regexes) and Semgrep rules.

**Adopted:**
- ~19 secret patterns: AWS keys, Stripe/OpenAI/SendGrid/GitHub/Slack, private keys,
  DB URIs (Mongo/Postgres/MySQL/Redis), JWTs, Firebase config, generic `password=`.
- Stack-trace & internal-IP leakage detection.
- Mixed-content and CSRF-less form detection.

## 7. Endpoint intelligence

**Adopted / inspired by Burp engagement mapping + source-map exposure research:
- Endpoint map built from crawled URLs + regex on HTML/JS source (`fetch`, `axios.get`,
  `"/api/..."` strings).
- Each endpoint probed; API paths flagged; **cache-control on sensitive paths** flagged
  (Web cache poisoning / data leakage surface).
- Open-redirect patterns (`location/next/return/url` params) flagged from source.

## 8. WAF / edge-detection awareness

We skip CDN-proxied banner false-positives (Cloudflare/Vercel/Netlify server banners are
not reported), matching Corsair's approach of not penalizing platforms.

---

## Next candidates (not yet implemented)

- Wayback CDX historical endpoint discovery (wayback.archive.org).
- WAF fingerprint heuristics (Cloudflare challenge header, `__cf_bm` cookie).
- Confidence scoring per finding (Metasploit-style).
- `Cache-Control: no-store` recommendation on all auth endpoints (check-only today).
- CORS preflight (OPTIONS with `Origin`) to confirm actual cross-origin readability.
