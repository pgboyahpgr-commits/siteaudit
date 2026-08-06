# Build Plan (Roadmap)

Phased roadmap from empty repo to a live $0-budget product. Each phase has a clear
"definition of done".

---

## Phase 1 — Scanner CLI + Report (prove the core)

**Goal:** a working scanner that takes a URL and produces a real findings report — no
website yet.

**Deliverables**
- `scanner/` with the 6-phase pipeline (discovery -> fingerprint -> enumerate -> vuln
  -> report)
- Tool wrappers for httpx, katana, whatweb, gobuster, nuclei
- `node scanner/cli.js --url https://example.com --mode passive`
- JSON + HTML report output in `reports/`
- `scripts/install-tools.ps1` / `.sh`
- Unit tests for normalization + fix rules

**Done when:** running the CLI against a local test site yields a scored, fix-annotated
report with evidence snippets.

---

## Phase 2 — Fix Engine (OWASP mapping)

**Goal:** every finding carries human remediation.

**Deliverables**
- `scanner/rules/owasp.js` with rules for all 8 categories
- Interpolation of real values (CVE id, missing header, versions)
- Severity/score implementation
- Re-scan diff data structure

**Done when:** 100% of finding categories produce a fix + reference in tests.

---

## Phase 3 — Website + API (product UX)

**Goal:** paste a URL in the browser and see results.

**Deliverables**
- `server/` Fastify API (scan, verify, report routes; SQLite; queue; rate limits;
  consent logging)
- `web/` React dashboard (scan form, live progress, findings table, verification modal,
  Full Check button, report exports, terms page)
- Ownership verification flow (file/meta/header/DNS/email)
- CORS + env config

**Done when:** a full passive scan runs from the browser and the verification modal
unlocks the Full Check on a test domain the operator controls.

---

## Phase 4 — Deployment (free tier)

**Goal:** live on the internet for $0.

**Deliverables**
- Vercel frontend deploy
- Railway/Render API deploy with persisted SQLite
- Worker on Codespaces / Oracle VM
- GitHub Actions scheduled re-scan
- `vercel.json`, `netlify.toml`, `render.yaml`, `devcontainer.json` committed

**Done when:** an outside user can scan, verify, and run a Full Check end-to-end.

---

## Phase 5 — AI Polish (optional)

**Goal:** plain-English value-add.

**Deliverables**
- Optional LLM summary + prioritization behind a toggle
- Free-tier provider (Cloudflare Workers AI / Groq / Gemini)
- Feature flag so it can run without any AI key

**Done when:** a non-technical user understands the report without opening the fixes.

---

## Phase 6 — Hardening & Growth

- False-positive tuning, dedup of similar findings
- Per-finding "verify manually" links
- Report history + team sharing
- Import from sitemap, CI integration (`siteaudit scan --ci`)
- Multi-region queue (Turso/D1) if traffic grows

---

## Timeline (indicative, solo effort)

| Phase | Effort | Duration |
|-------|:------:|----------|
| 1 | Medium | 2-3 days |
| 2 | Small | 1 day |
| 3 | Large | 5-7 days |
| 4 | Medium | 2-3 days |
| 5 | Small | 1-2 days |
| 6 | Ongoing | as needed |

---

## Immediate Next Step (Phase 1 start)

1. Scaffold the repo: root `package.json` (npm workspaces: `web`, `server`, `scanner`).
2. Write `scripts/install-tools.ps1` and install the Go-based tools.
3. Build `scanner/phases/` in order, starting with `1-discovery.js` + `httpx`.
4. Validate against a safe local test target (e.g. a local Node server, or
   `https://example.com`).
