# SiteAudit — AI Security, Privacy & Trust Agent

> Paste a URL. SiteAudit reverse-engineers the entire site — every page, source file,
> endpoint, and secret — then an **AI security analyst** explains your risk in plain
> English, ranks exactly what to fix, runs a **VibeCheck** (how trustworthy does the site
> actually look?), and answers your questions. **Built for a $0 budget.**

SiteAudit is an AI-powered security, privacy & trust platform for the modern web — the
world's first web-app **reverse-engineering + trustworthiness agent**. It answers two
questions nobody else's scanner answers:

1. **"Is my app actually broken?"** — full passive recon, reverse-engineered endpoints,
   exposed secrets, CVEs, weak config, with evidence and concrete fixes.
2. **"Does my app look like a low-effort vibe-coded prototype?"** — a quantified
   **VibeCheck** score with AI-written guidance to make it trustworthy.

---

## Problem Statement

Millions of apps are now built in hours with AI assistance. The result: **a trust crisis**.
Independent developers and small businesses ship to production with exposed `.env` files,
hardcoded API keys, default templates, placeholder copy, and broken security headers —
and they have no idea. Professional pentesting costs thousands of dollars; free scanners
cough up jargon-filled XML that a non-technical founder can't act on; and nothing
evaluates how much an app *looks* like an untrustworthy, hastily-generated prototype.

**SiteAudit fixes this** with a free, legal, AI-powered agent that anyone can run on
their own site, in their own account, with their own data.

---

## Solution Overview

- **Reverse-engineering engine** crawls the site and maps every page, endpoint, API
  route, source file, secret, and technology version.
- **Risk engine** finds exposures, misconfigs, header issues, TLS problems, and
  version-gated CVEs — every finding with evidence, a plain-English explanation, and a
  step-by-step fix.
- **AI Security Analyst** (Google Gemini → OpenAI → Anthropic → **built-in local
  fallback**) writes the plain-language risk report, the prioritized fix plan, and the
  VibeCheck narrative. Works even with zero API keys.
- **AI Security Advisor chat** answers questions about *your* scan, grounded only in your
  data.
- **VibeCheck** quantifies how "vibe-coded" a site looks (boilerplate scaffolds,
  placeholder copy, AI-generation fingerprints, dead links, missing trust markers) on a
  0–100 scale with evidence and AI recommendations.
- **Ownership verification** (token file / meta tag / header / DNS TXT / DNS CNAME /
  email magic link) — the same model Google Search Console uses — gates the deeper
  Full Check.
- **Accounts & history** with JWT auth, bcrypt hashing, and SQLite storage, so your
  reports are yours and re-runnable. Score history charted over time.

---

## Key Features

| Area | What you get |
|------|--------------|
| Crawl & reverse-engineer | Polite same-host crawler, JS source analysis, endpoint map (status, content-type, API flag), subdomain enumeration via crt.sh |
| Exposures | ~90-path probe (`.git`, `.env`, SQL dumps, Actuator, Swagger, admin panels), directory listings, source maps, security.txt check, soft-404 filtering |
| Secrets & leaks | AWS/Stripe/OpenAI/GitHub/Slack keys, DB URIs, JWTs, private keys, emails, stack traces, internal IPs |
| Config & headers | 6 required + 3 advanced security headers, CSP weakness analysis, HTTP-method probing, cookie flags, CORS, cache-control on sensitive paths, HTTP→HTTPS redirect |
| TLS | Handshake, expiry, self-signed, legacy protocols |
| CVEs | Version-gated mini-CVE DB (jQuery, Angular, Bootstrap, WordPress, Lodash, PHP) |
| AI Risk Report | Plain-language summary, severity assessment, top priorities |
| AI Fix Plan | Prioritized remediation steps (action + why), plus per-finding fixes |
| VibeCheck | 0–100 "how vibe-coded" score, detected signals, AI recommendations |
| Advisor Chat | Ask anything about your scan — grounded answers |
| Full Check | Active testing unlocked only after ownership verification |
| Account & history | JWT + bcrypt + SQLite; saved scans; Recharts score history |

---

## Tech Stack (assignment-compliant)

| Requirement | Used |
|---|---|
| Frontend | React 18, Vite, React Router, custom pixel-CRT design system, Recharts |
| Data fetching | Fetch API (in `web/src/api.js`) |
| Backend | Node.js + **Express** |
| Auth | **JSON Web Token (JWT)** (`jsonwebtoken`) |
| Password hashing | **bcrypt** (`bcryptjs`) |
| Validation | **Zod** (schemas on scan/auth/challenge/chat inputs) |
| Database | **SQLite** via `node:sqlite` (`server/src/db.js`) |
| AI | **Google Gemini** (default) → **OpenAI** → **Anthropic Claude**, keyed in backend env only, with a deterministic local fallback when no key is set or the API is down |
| Deploy | Vercel/Netlify (frontend), Render/Railway (backend) |

See [docs/SUBMISSION.md](docs/SUBMISSION.md) for the full mapping and deliverables.

---

## Repository Layout

```
siteaudit/
├── web/                    # React (Vite) frontend
│   └── src/
│       ├── pages/          # HomePage, ScanPage, AuthPage, MyScansPage
│       ├── components/     # VerificationModal, AiPanels, AdvisorChat, EndpointTable, ScoreRing
│       ├── api.js          # fetch client (JWT-aware)
│       ├── report.js       # JSON/HTML/CSV export
│       ├── theme.js        # design tokens
│       └── styles.css      # pixel-CRT design system
├── server/                 # Node + Express API & scan engine
│   ├── src/
│   │   ├── index.js        # Express bootstrap (CORS, JSON, errors)
│   │   ├── routes.js       # /scan /verify /auth /ai /chat /report + Zod + rate limits
│   │   ├── auth.js         # JWT + bcrypt (register/login/requireAuth)
│   │   ├── db.js           # SQLite (users, scans, chat_messages)
│   │   ├── queue.js        # in-process scan queue (fires AI after completion)
│   │   ├── store.js        # JSON persistence for scans/reports/verifications
│   │   ├── scan/           # engine, crawl, fingerprint, checks, tls, verify, fixes, cve
│   │   └── ai/             # ai.js (multi-provider + local fallback), vibe.js
│   └── .env.example        # copy to .env — AI keys live ONLY here
├── scripts/                # test-target.mjs (deliberately-vulnerable demo site)
├── docs/                   # full documentation set
└── package.json            # npm workspaces (web + server)
```

---

## Quickstart

### Prerequisites
- Node.js **22.5+** (for `node:sqlite`) — 24 recommended.

### Install
```powershell
npm install
```

### Run locally
```powershell
npm run dev          # starts API (port 4000) + web (port 5173) together
```

### Try it against the bundled demo target
```powershell
node scripts/test-target.mjs     # vulnerable demo site on port 5099
npm run dev                      # SiteAudit
```
Scan `http://localhost:5099/` to see real findings, the AI Risk Report, the VibeCheck
score (the demo triggers "Full AI prototype"), the fix plan, and the advisor chat.

### Set up AI (optional — everything works without it)
1. `Copy-Item server/.env.example server/.env`
2. Add `GEMINI_API_KEY` (free at aistudio.google.com), or `OPENAI_API_KEY` /
   `ANTHROPIC_API_KEY`.
3. Restart the server. The AI analyst and vibe narrative now use real LLMs; if a
   provider fails, SiteAudit automatically falls back to the next, then to local rules.

---

## How Ownership Verification Works

Modeled on Google Search Console's verification system — prove you control the site by
placing a token where only you can:

| Method | Works on `*.vercel.app`? | Needs custom domain? |
|--------|:------------------------:|:--------------------:|
| **Token file** at `/.well-known/siteaudit-verify.txt` | Yes | No |
| **HTML meta tag** | Yes | No |
| **HTTP header** (`X-SiteAudit-Token`) | Yes | No |
| **DNS TXT** `_siteaudit` | No | Yes |
| **DNS CNAME** `_siteaudit` | No | Yes |
| **Email magic link** | No | Yes |

The server reads the token back from **your** site (never trusts a screenshot), auto-polls
every 8s, and only then unlocks the **Full Check**. Full details: [docs/VERIFICATION.md](docs/VERIFICATION.md).

---

## Security & Legal Model

- Consent checkbox records URL + timestamp + verifier IP for every scan.
- Full Check (active testing) is impossible without verified ownership.
- Scanner scope-locks to the submitted host.
- Rate limits (15 scans/hour/IP, loopback-exempt) + soft pacing.
- Passwords are bcrypt-hashed; API keys live only in backend env vars.
- AI responses are grounded in your scan data and instructed never to invent CVEs.

---

## Documentation

| Document | Covers |
|----------|--------|
| [docs/SUBMISSION.md](docs/SUBMISSION.md) | Hackathon deliverables: problem, solution, stack mapping, demo script |
| [docs/RESEARCH.md](docs/RESEARCH.md) | Open-source inspiration & roadmap |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, modules, data flow |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Ownership verification how-to |
| [docs/SCANNER-ENGINE.md](docs/SCANNER-ENGINE.md) | Engine phases + tooling |
| [docs/REPORTING-AND-FIXES.md](docs/REPORTING-AND-FIXES.md) | Findings schema, score, fixes |
| [docs/SECURITY-LEGAL.md](docs/SECURITY-LEGAL.md) | Legal safeguards |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | $0 deployment guide |
| [docs/TECH-STACK.md](docs/TECH-STACK.md) | Stack choices & rationale |

---

## License

MIT — free to use, modify, and deploy.

> **Important:** Use SiteAudit only on websites you own or have explicit written
> permission to test. Unauthorized scanning is illegal in most jurisdictions.
