# Hackathon Submission — SiteAudit

Theme: **AI Security, Privacy & Trust** — Scenario-Based Challenge.

---

## Problem Statement

AI-assisted development has made it trivial to ship a website in an afternoon — and just
as easy to ship one that leaks secrets, exposes private data, and *looks* untrustworthy.
Independent developers and small businesses publish apps with exposed `.env` files,
hardcoded API keys, default framework templates, placeholder copy, and missing security
headers — and have no affordable way to find out. Professional penetration testing costs
thousands of dollars, free scanners return jargon-filled XML that founders can't act on,
and no tool evaluates how much an app *appears* to be a hastily generated, low-effort
prototype (a major factor in user trust).

## Solution Description

**SiteAudit** is a free, legal, AI-powered **security, privacy & trust agent** for any
website you own or are authorized to test. Paste a URL and SiteAudit:

1. **Reverse-engineers** the site — polite same-host crawl, JS/source analysis, endpoint
   mapping, subdomain enumeration, tech fingerprinting.
2. **Finds the problems** — exposed files (`/.env`, `/.git`, SQL dumps), hardcoded
   secrets, weak/missing security headers, TLS issues, risky config, and version-gated
   CVEs — each with evidence and a concrete fix.
3. **Explains it in plain English with AI** — an AI Security Analyst writes the risk
   report and prioritized fix plan using Google Gemini (with automatic fallback to
   OpenAI, Anthropic, then a deterministic local engine, so the product **never breaks**
   when a provider is down or no key is configured).
4. **Runs a VibeCheck** — a quantified 0–100 score of how "vibe-coded" / low-effort the
   site looks, with detected signals and AI recommendations to make it production-grade.
5. **Answers questions** — an AI Security Advisor chat grounded in your scan data.
6. **Gates deep testing behind real ownership proof** — Google-Search-Console-style
   verification (token file, meta tag, header, DNS TXT/CNAME, email magic link) unlocks
   the Full Check.

### AI integration
- **Multi-provider chain:** Gemini (free tier) → OpenAI → Anthropic, read **only from
  backend environment variables** — never shipped to the browser.
- **Working fallback:** if no key is set or a provider is down/rate-limited, SiteAudit
  silently switches to its local rule-based analyst. AI features always respond.
- AI is **grounded**: prompts receive only the user's scan data and are instructed never
  to invent vulnerabilities or CVEs.

### Privacy & trust
- Every scan requires a consent acknowledgement, recorded with timestamp and IP.
- Active testing requires verified ownership.
- Accounts use JWT + bcrypt; your scan history is private to your account.
- Passwords never stored in plaintext; API keys never leave the server.

---

## Stack Compliance Checklist

| Assignment requirement | Implementation |
|---|---|
| React.js + Vite | `web/` — React 18, Vite 5 |
| React Router | `web/src/App.jsx` routes: `/`, `/scan/:id`, `/auth`, `/my` |
| UI framework | Custom pixel-CRT design system (`web/src/styles.css`) |
| Axios or Fetch API | Fetch API in `web/src/api.js` |
| Charts (optional) | Recharts (score-history bar chart on `/my`) |
| Node.js + Express.js | `server/` — Express 5 |
| JWT auth | `server/src/auth.js` (`jsonwebtoken`) |
| bcrypt hashing | `server/src/auth.js` (`bcryptjs`) |
| Zod validation | `server/src/routes.js` — scan, register, login, challenge, chat schemas |
| Database | SQLite via `node:sqlite` — `server/src/db.js` (users, scans, chat) |
| AI API | Gemini (default) → OpenAI → Anthropic; keys in `server/.env` only |
| Version control | This GitHub repository |
| Deployment | Vercel (frontend) + Render/Railway (backend) — see `docs/DEPLOYMENT.md` |

---

## Deliverables

| Requirement | Status / Location |
|---|---|
| Problem statement | Above |
| Solution description | Above |
| GitHub repo (frontend + backend + README) | This repo — README.md covers setup & execution |
| Deployed application link | Set after deploy (see `docs/DEPLOYMENT.md`) |
| Demo video (3–5 min) | Script below |

### Demo video script (≈4 min)
1. **Hook (0:20)** — "Every site you deploy today could be leaking secrets you don't know
   about — and if it looks vibe-coded, users won't trust it. Here's the agent that checks
   both."
2. **Scan (0:45)** — paste `http://localhost:5099` (or the live demo), agree to consent,
   run the scan. Show the live terminal phases, progress, and score ring.
3. **Findings (0:45)** — filter by severity; open a critical finding (exposed `.env` /
   secrets) showing evidence, explanation, and the fix.
4. **Endpoint map (0:25)** — reverse-engineered endpoints incl. API flags.
5. **AI Risk Report + Fix Plan (0:40)** — plain-language summary and prioritized steps;
   highlight provider badge.
6. **VibeCheck (0:35)** — 72/100 "Full AI prototype", signals list, AI recommendations.
7. **Advisor chat (0:30)** — ask "what should I fix first?" and get a grounded answer.
8. **Verification + Full Check (0:35)** — generate token, verify (auto-poll), unlock and
   run the Full Check; show verified badge.
9. **Account/history (0:25)** — register/login, saved scans, score trend chart.

---

## Deployment Notes

- Frontend: `npm run build` in `web/`, deploy `web/dist` to Vercel/Netlify; set
  `VITE_API_URL` to the backend URL.
- Backend: push `server/` to Render/Railway with `npm run start`, Node 22.5+; set env
  vars from `server/.env.example` (`JWT_SECRET` must be a long random string).
- The API serves routes both at root and under `/api` so both the Vite dev proxy and a
  production frontend work.
- The bundled demo target (`scripts/test-target.mjs`) can be hosted on a free Vercel
  project for the live demo.
