# Scanner Engine

The scanner is the heart of SiteAudit. This document covers the tools, the phased
pipeline, installation, and configuration.

---

## 0. As-Built (Node in-process engine)

The shipped engine runs entirely in-process (`server/src/scan/`) with zero external
binaries — see the planned external-tool pipeline below for the roadmap.

**8-phase pipeline** (`engine.js` → `checks.js` / `cve.js` / `fixes.js`):

1. **Discovery** — polite crawler (`crawl.js`), same-host scope lock, robots.txt +
   sitemap fetch, disallowed-path probing.
2. **Fingerprint** — tech/CMS + version detection, server-banner handling (CDN banners
   suppressed), **crt.sh subdomain enumeration** (passive CT-log recon).
3. **Headers** — required header audit (6) + advanced headers (COOP/COEP/OACP),
   **CSP weakness analysis**, **HTTP-method probe (OPTIONS)**, cookie flags
   (Secure/HttpOnly/SameSite), CORS analysis, HTTP→HTTPS redirect check.
4. **TLS** — handshake, expiry, self-signed, weak protocol via `node:tls`.
5. **Enumeration** — ~90-path exposure wordlist (`.git`, `.env`, dumps, actuator,
   swagger, admin panels) with soft-404 filtering, directory listing, source maps,
   **security.txt presence**.
6. **Endpoints** — endpoint map from crawled URLs + HTML/JS source regex; per-endpoint
   probe with API flag; **cache-control on sensitive paths**; unauthenticated API finding.
7. **Source review** — ~19 secret patterns, emails, stack traces, internal IPs, mixed
   content, CSRF-less forms, **open-redirect patterns**.
8. **CVE matching** — version-gated mini-CVE DB (jQuery, Angular, Bootstrap, WordPress,
   Lodash, PHP).

Findings carry severity, category, evidence, fix + references (see
[REPORTING-AND-FIXES.md](REPORTING-AND-FIXES.md)). Inspiration sources and roadmap are in
[RESEARCH.md](RESEARCH.md).

---

## 1. Tools at a Glance

| Tool | Language | Purpose |
|------|----------|---------|
| **httpx** | Go (ProjectDiscovery) | HTTP probing: live hosts, status, title, tech, TLS info |
| **katana** | Go (ProjectDiscovery) | Crawler + JS parser: finds endpoints, paths, secrets in source |
| **whatweb** | Ruby | Tech fingerprint: CMS, framework, server, versions |
| **gobuster** | Go | Directory/file brute-forcing with wordlists |
| **nuclei** | Go (ProjectDiscovery) | Vulnerability scanner: 7,000+ YAML templates |
| **OWASP ZAP** | Java | Active web app scanning: XSS, injection, more |
| **sqlmap** | Python | Automated SQL injection detection/exploitation (safe mode) |

---

## 2. The Phased Pipeline

The worker runs phases in order. Each phase feeds JSON to the next.

```
1-discovery  ─► 2-fingerprint  ─► 3-enumerate  ─► 4-vuln  ─► (5-active)  ─► 6-report
```

### Phase 1 — Discovery
- `httpx` on the target + seed URLs from `robots.txt`/`sitemap.xml`.
- `katana crawl -u <target> -js-crawl -known-files=all` to discover pages, JS files,
  and endpoints embedded in scripts.
- **Output:** `endpoints.json`, `source_files.json`, `tech.json`.

### Phase 2 — Fingerprint
- `whatweb <target>` for CMS/framework/server + versions.
- Map versions to candidate Nuclei templates.
- **Output:** `fingerprint.json`.

### Phase 3 — Enumerate
- `gobuster dir -u <target> -w common.txt` for hidden/admin paths (passive wordlist).
- Grep katana's JS output for hardcoded secrets, API keys, tokens, DB strings.
- Detect exposed files: `.git`, `.env`, `.bak`, `config.*`, `*.log`, `phpinfo()`.
- **Output:** `enum.json`, `secrets.json`.

### Phase 4 — Vulnerability (passive)
- `nuclei -u <target>` with template selection based on fingerprint.
- Focused tags: `-tags misconfig,exposure,default-login,cve`.
- **Output:** `nuclei.json`.

### Phase 5 — Active (FULL MODE ONLY, gated)
- `zap-cli` active scan (XSS, injection, SSRF).
- `sqlmap -u <target> --batch --level 1 --risk 1` (safe, non-destructive flags).
- Runs only when `scan.verified === true`.
- **Output:** `active.json`.

### Phase 6 — Report
- Normalize all phase outputs into the canonical finding schema (see
  [REPORTING-AND-FIXES.md](REPORTING-AND-FIXES.md)).
- Attach rule-based fixes via the OWASP mapping engine.
- Compute security score, write `report.json`, generate `report.html`/`.csv`.

---

## 3. Installation

### Windows (PowerShell)
```powershell
# ProjectDiscovery tools (httpx, katana, nuclei)
winget install ProjectDiscovery.Nuclei
winget install ProjectDiscovery.Httpx
winget install ProjectDiscovery.Katana
# or via Go:
# go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
# go install -v github.com/projectdiscovery/katana/cmd/katana@latest
# go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# gobuster
winget install gobuster

# whatweb (Ruby gem)
gem install whatweb
# or via scoop:
# scoop install whatweb

# OWASP ZAP
winget install OWASP.Zap

# sqlmap (Python)
pip install sqlmap
```

### macOS (Homebrew)
```bash
brew install httpx katana nuclei gobuster whatweb
brew install --cask zap
pip install sqlmap
```

### Linux (Debian/Ubuntu)
```bash
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/katana/cmd/katana@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
sudo apt install gobuster whatweb -y
sudo snap install zaproxy --classic
pip install sqlmap
```

> The project ships `scripts/install-tools.ps1` and `scripts/install-tools.sh` that run
> the right commands per OS. Run once after clone.

---

## 4. Example Commands Used by the Worker

```bash
# httpx
httpx -u https://example.com -title -status-code -tech-detect -json -o out/httpx.json

# katana
katana -u https://example.com -js-crawl -known-files=all -silent -json -o out/katana.json

# whatweb
whatweb --log-json=out/whatweb.json https://example.com

# gobuster (passive wordlist)
gobuster dir -u https://example.com -w wordlists/common.txt -q -o out/gobuster.txt

# nuclei
nuclei -u https://example.com -json -o out/nuclei.json

# zap (active, full mode)
zap-cli quick-scan -s xss,sqli,ssrf --spider https://example.com

# sqlmap (safe mode)
sqlmap -u https://example.com/?id=1 --batch --level 1 --risk 1 --no-cast
```

All commands run with a hard timeout and `--silent`-style flags to keep output
parseable. Child processes are killed on timeout.

---

## 5. Wordlists

| Wordlist | Source | Use |
|----------|--------|-----|
| `common.txt` | Dirsearch default | Passive enumeration |
| `directory-list-2.3-medium.txt` | SecLists | Full-mode enumeration |
| `raft-large-directories.txt` | SecLists | Full-mode deep enumeration |

Bundled under `scanner/wordlists/` (git submodule or download from
[SecLists](https://github.com/danielmiessler/SecLists)).

---

## 6. Configuration (env)

| Variable | Default | Meaning |
|----------|---------|---------|
| `SCAN_TIMEOUT_MS` | 900000 | Per-phase hard timeout (15 min) |
| `MAX_REQ_PER_SEC` | 5 | Target pacing |
| `NUCLEI_TAGS` | `misconfig,exposure,default-login,cve` | Template focus |
| `VERIFY_TOKEN_TTL_MS` | 3600000 | Verification token expiry |
| `OUT_DIR` | `./scanner/out` | Raw output + reports |
| `INTERNAL_API_KEY` | — | For worker->server auth |

---

## 7. Failure Handling

- Tool missing: phase fails fast with a clear message + pointer to install scripts.
- Target unreachable: scan marked `failed`, friendly error surfaced.
- Phase timeout: child killed, results up to that point still processed.
- Empty findings: report still generated with `score` reflecting only what was checked.

---

## 8. Extending

New scanners are added as `scanner/tools/<name>.js` returning a normalized output, plus
a rule entry in `scanner/rules/owasp.js`. The 6-phase pipeline stays stable.
