# Tech Stack

Everything in SiteAudit is free and open-source. This document explains each choice,
why it was made, and the alternatives considered.

---

## 1. Frontend

| Technology | Why |
|------------|-----|
| **React 18 + TypeScript** | Huge ecosystem, easy hiring/contribution, component model fits dashboards |
| **Vite** | Instant dev server, fast HMR, free builds |
| **Tailwind CSS** | Rapid UI development without a design system |
| **React Router** | Clean routing (`/`, `/scan/:id`, `/report/:id`) |
| **Chart.js (react-chartjs-2)** | Severity charts + score gauge |
| **Vercel / Cloudflare Pages / Netlify** | Free static hosting, CDN, zero config |

### Why not
- **Next.js** — great, but we do not need SSR; the API is separate, so Vite keeps the
  frontend dead-simple to host anywhere.
- **Plain HTML/JS** — fine for a mockup, but the dashboard UI (live progress, filters,
  modals) benefits heavily from React.

---

## 2. API Server

| Technology | Why |
|------------|-----|
| **Node.js 18+** | Same language as the scanner worker, one toolchain |
| **Fastify** | Fast, schema-driven validation, first-class TypeScript |
| **SQLite (better-sqlite3)** | Zero-dependency database, file-based, free forever, perfect for this scale |
| **BullMQ (or custom SQLite queue)** | Job queue with retries; can start in-memory and scale later |

### Why not
- **Express** — fine, but Fastify gives validation + speed for free.
- **Postgres/MySQL** — overkill and not free unless you host it yourself; SQLite is
  more than enough for hundreds of scans/day. Migrate to **Turso** or **Cloudflare D1**
  (both free tier) later if you need multi-region.

---

## 3. Scanner Engine

All open-source, all free:

| Tool | Purpose |
|------|---------|
| **httpx** | HTTP probing, live hosts, status codes, tech detection |
| **katana** | Crawling + JS endpoint/secret extraction |
| **whatweb** | Tech fingerprinting (CMS, framework, server, versions) |
| **gobuster** | Directory/file brute-forcing |
| **nuclei** | 7,000+ vulnerability templates (CVEs, misconfigs, exposures) |
| **OWASP ZAP** | Active web app scanning (XSS, injection, etc.) |
| **sqlmap** | Automated SQL injection testing |

Installed via Go (`go install`), package managers, or prebuilt binaries. See
[SCANNER-ENGINE.md](SCANNER-ENGINE.md).

---

## 4. Fix / Suggestion Engine

| Technology | Why |
|------------|-----|
| **Rule-based OWASP/WSTG mapping** (default) | Deterministic, free, always correct — every finding type maps to a remediation rule with references |
| **Optional free LLM** | Cloudflare Workers AI / Groq / Gemini free tier for plain-English summaries and prioritization (opt-in, disabled by default) |

### Why rule-based first
- No cost, no rate limits, no hallucinations.
- Every `category` in the finding schema has a hand-written remediation template.
- The LLM is an enhancement on top, never the source of truth.

---

## 5. Infrastructure (all free tiers)

| Piece | Recommended | Alternative | Limits |
|-------|-------------|-------------|--------|
| Frontend hosting | Vercel Hobby | Cloudflare Pages, Netlify | 100 GB bandwidth/mo (Vercel) |
| API hosting | Railway Trial / Render Free | Cloudflare Workers | Sleeps after inactivity on free tiers |
| Scanner worker | GitHub Codespaces (120 core-hrs/mo) | Oracle Always-Free VM (4 vCPU / 24 GB RAM) | Codespace auto-stops after 30 min idle |
| Scheduled re-scans | GitHub Actions cron | Worker cron on free tier | 2,000 min/mo (free) |
| Database | SQLite (in API VM) | Turso / Cloudflare D1 free | N/A at this scale |
| Domain | `*.vercel.app` / `*.railway.app` | Free `.pages.dev` | No custom domain needed |

> **Tip:** Free-tier VMs (Railway/Render) sleep after inactivity. For a truly always-on
> worker, use **Oracle Always Free** or a Raspberry Pi at home, or let GitHub Actions
> spin up a Codespace per scan.

---

## 6. Deployment CLIs

We use the official CLIs so the whole deploy can be scripted:

| CLI | Install | Used for |
|-----|---------|----------|
| `vercel` | `npm i -g vercel` | Frontend deploy |
| `railway` | `npm i -g @railway/cli` | API deploy |
| `gh` | GitHub CLI | Actions + repo automation |
| `docker` | Docker Desktop | Worker image build |

> Auth: the human runs `vercel login` / `railway login` / `gh auth login` **once**;
> the agent/scripts reuse the saved sessions thereafter.

---

## 7. Optional: AI Layer (0-cost)

| Provider | Free tier | Notes |
|----------|-----------|-------|
| Cloudflare Workers AI | 10k neurons/day | Fast, already on the CDN |
| Groq | Free tier, fast | LPU speed, good for summaries |
| Gemini API | Free tier (60 req/min) | Generous, easy key |
| OpenRouter | Free models | Router with free model access |

The AI feature is **disabled by default**; it only activates when the user opts in and
a provider key is present.

---

## 8. Language & Tooling Summary

| Concern | Choice |
|---------|--------|
| Language (web + server + worker) | TypeScript |
| Scanner control | Node.js child-process wrappers |
| Package manager | npm workspaces (root `package.json`) |
| Lint/format | ESLint + Prettier |
| Tests | Vitest (unit) + Playwright (frontend E2E) |
| CI | GitHub Actions (lint, typecheck, test) |
