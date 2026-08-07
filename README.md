# SiteAudit — AI Security, Privacy & Trust Agent

> **Paste a URL. Get a complete security report in 30 seconds.**  
> Reverse-engineer every page, API endpoint, secret, and vulnerability — then get plain-English fixes powered by 5 AI engines.  
> **Zero cost. Zero signup. One click.**

<p align="center">
  <a href="https://siteaudit-six.vercel.app"><strong>🔗 Try it live → siteaudit-six.vercel.app</strong></a>
</p>

---

## What SiteAudit Does

SiteAudit is the **most comprehensive free web security scanner** on the internet. It combines a 9-phase reverse-engineering engine with multi-provider AI analysis, a unique trustworthiness scoring system (VibeCheck), and 15 client-side forensic engines — all accessible from a single URL paste.

**No other tool does all of this:**

| Capability | SSL Labs | Observatory | SecurityHeaders | SiteAudit |
|-----------|----------|-------------|-----------------|-----------|
| 9-phase crawl + scan | ✗ | ✗ | ✗ | ✓ |
| 90-path secret probe | ✗ | ✗ | ✗ | ✓ |
| Endpoint reverse-engineering | ✗ | ✗ | ✗ | ✓ |
| CVE matching (22 entries) | ✗ | ✗ | ✗ | ✓ |
| AI risk report + fix plan | ✗ | ✗ | ✗ | ✓ |
| VibeCheck trust score | ✗ | ✗ | ✗ | ✓ |
| AI Image Detector (5 engines) | ✗ | ✗ | ✗ | ✓ |
| 15 client-side forensic engines | ✗ | ✗ | ✗ | ✓ |
| GitHub CI integration | ✗ | ✗ | ✗ | ✓ |
| Competitor side-by-side | ✗ | ✗ | ✗ | ✓ |
| Free, no signup | ✓ | ✓ | ✓ | ✓ |

---

## Features

### 🔍 Web Scanner (9 Phases)
1. **Discovery** — Crawl up to 50 pages, robots.txt, sitemap analysis
2. **Fingerprint** — Detect 40+ technologies with version extraction (cloudflare-nginx → Cloudflare + Nginx)
3. **Headers** — Audit 6 required + 3 advanced security headers, CSP, CORS, cookies, cache, HTTP→HTTPS redirect
4. **TLS** — Handshake analysis, certificate validation, protocol check, SANs enumeration
5. **Enumeration** — Probe 90+ paths (.git, .env, SQL dumps, Swagger, admin panels), directory listings, source maps
6. **Endpoints** — Reverse-engineer API routes from JS source, probe each for auth requirements
7. **Source Review** — 18 secret patterns (AWS, Stripe, OpenAI, GitHub, Slack, DB URIs, JWTs), emails, stack traces, mixed content, CSRF
8. **CVE Matching** — 22 entries covering React, Next.js, Express, Nginx, Apache, Vue, Django, Laravel, WordPress, Bootstrap, jQuery, PHP, Node.js
9. **Active Probes** *[Full Check only]* — SQL injection, XSS reflection, CSRF detection, open redirect tests

### 🤖 AI Analysis
- **5-provider chain:** LM Studio (your machine) → Gemini → xAI → Completions → Pollinations (guaranteed fallback)
- **AI Site Story** — Auto-generated narrative summary of scan findings
- **Risk Report** — Plain-language severity assessment with top priorities
- **Fix Plan** — Prioritized remediation steps with exact code/config per finding
- **AI Security Advisor** — Per-scan chat grounded only in your data
- **Reversiy** — Floating AI companion on every page, works offline with local fallback

### 🎯 VibeCheck — Trust Score (Unique)
Quantifies how "vibe-coded" a site looks (0-100):
- Boilerplate scaffold detection
- Placeholder content / lorem ipsum
- Free proxy backends
- Hardcoded demo/seed data
- Template leftover detection (Vite, CRA, Next.js defaults)
- AI-generation fingerprints
- Vibe score certificate with radar chart breakdown

### 🔬 AI Image Detector (100% Client-Side)
5 forensic engines running entirely in your browser:
1. **C2PA** — Digital provenance manifest scanning (9 markers, 20+ generator names)
2. **EXIF** — Camera metadata + 16 AI tool indicators
3. **SynthID** — Google DeepMind DCT frequency domain watermark detection
4. **8 Heuristic Engines** — Noise, edges, colors, patterns, chromatic aberration, coherence, blockiness, detail
5. **WebGPU ML** — ai-source-detector-ONNX classifier (SD, Midjourney, DALL-E, Real)
- **ELA** — Error Level Analysis forensic edit detection
- **Weighted consensus** verdict cross-referencing all signals

### 🛠️ Deep Scan — 15 Client-Side Engines
| Metric | Score |
|--------|-------|
| JS Bundle Analysis | First/third-party scripts, framework detection |
| CSS Quality | !important count, deep nesting, ID selectors |
| Auto CSP Generator | Script/style/img/font origin enumeration |
| Email Security | SPF/DKIM/DMARC check + DNS record generation |
| Security.txt | Auto-generated RFC 9116 file |
| Broken Resources | 4xx/5xx page detection |
| Semantic HTML | Heading hierarchy, landmarks, ARIA |
| Meta Tags | OG, Twitter Cards, canonical completeness |
| Structured Data | JSON-LD schema validation |
| DOM Complexity | Element count, nesting depth |
| Third-Party Risk | Service risk scoring (Ads=high, CDN=low) |
| SRI Check | Subresource Integrity on CDN resources |
| Web Vitals | Estimated FCP/LCP/TBT |
| Accessibility | Alt text, labels, lang attribute |
| Link Health | noopener, nofollow, external vs internal |

### 🔗 Additional Tools
- **URL Engineer** — Decompose URLs, follow redirect chains, detect 30+ tracking params
- **Side-by-Side Comparison** — Compare two sites with winner banner, diff visualization
- **Scan History** — localStorage persistence, auto-save, side-by-side diff mode
- **Fix Code Generator** — Platform-specific configs (Vercel, Nginx, Apache, Express, Cloudflare, Netlify)
- **GitHub CI Generator** — One-click `.github/workflows/siteaudit.yml`
- **Share as Image** — Branded PNG share card with score and logo
- **Embed Badge** — SVG badge for your site showing live security score
- **PDF/Markdown/JSON/CSV/HTML Export**
- **Dark/Light mode** — 🌙 toggle with full component coverage
- **Onboarding Tour** — 7-step interactive walkthrough
- **LM Studio Integration** — Run AI 100% locally, zero data leaves your machine
- **Easter Egg** — Try scanning `siteaudit-six.vercel.app` 😄

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (React 18 + Vite 5)                    │
│  → Vercel (https://siteaudit-six.vercel.app)     │
│  → 14 pages, 20+ components, lazy loading        │
└──────────────┬──────────────────────────────────┘
               │ /api/*
               ▼
┌─────────────────────────────────────────────────┐
│  Backend (Node.js 24 + Express 5)                │
│  → Render (siteaudit-backend-k96o.onrender.com) │
│  → 9-phase scan engine + 5-provider AI chain     │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Storage: SQLite (local) / Supabase (Postgres)   │
│  → Dual-mode with automatic failover             │
│  → JWT + bcrypt auth + GitHub OAuth              │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, React Router 6, Recharts 3 |
| **AI/ML (browser)** | HuggingFace Transformers (ONNX/WebGPU), DOMParser, Canvas API |
| **Backend** | Node.js 24+, Express 5, Zod 4 |
| **Auth** | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`), GitHub OAuth |
| **Database** | SQLite (`node:sqlite`) / PostgreSQL (`pg` via Supabase) |
| **AI Providers** | Gemini, xAI Grok, Completions AI, Pollinations AI, LM Studio (local) |
| **Deployment** | Vercel (frontend) + Render (backend) |
| **Monitoring** | Health check endpoint, SSE real-time progress |
| **Security** | Helmet-style headers, CORS, rate limiting, consent logging |

---

## Quickstart

### Prerequisites
- Node.js **22.5+** (24 recommended for `node:sqlite`)

### Install & Run
```bash
npm install
npm run dev          # API (port 4000) + Web (port 5173)
```

### Test with bundled vulnerable demo
```bash
node scripts/test-target.mjs    # Demo site on port 5099
npm run dev                      # In another terminal
```
Scan `http://localhost:5099/` to see real findings, AI reports, VibeCheck, and all features.

### Connect LM Studio (optional — local AI)
1. Install [LM Studio](https://lmstudio.ai) → download any model → Developer tab → Start Server
2. Go to SiteAudit Settings → Enable LM Studio → enter `http://localhost:1234/v1`
3. All AI features now run on YOUR hardware — zero data leaves your machine

### Deploy Your Own
```bash
# Frontend → Vercel
cd web && vercel --prod

# Backend → Render
# Push to GitHub → Render auto-deploys from render.yaml
```

---

## Repository Layout

```
siteaudit/
├── web/                          # React (Vite) frontend
│   └── src/
│       ├── pages/                # 14 pages (Home, Scan, Auth, Compare, Detector, Settings, Guide, FAQ, etc.)
│       ├── components/           # 20+ components (DeepScan, SiteGraph, SiteStory, VibeDeepDive, etc.)
│       ├── api.js                # JWT-aware fetch client with retry logic
│       ├── report.js             # JSON/CSV/HTML/Markdown/PDF export
│       ├── scanHistory.js        # localStorage persistence
│       └── styles.css            # 2400+ lines, dark/light themes, 4 breakpoints
├── server/                       # Node.js + Express backend
│   ├── src/
│   │   ├── index.js              # Server bootstrap + x-sa-settings middleware
│   │   ├── routes.js             # 25 REST endpoints with Zod validation
│   │   ├── auth.js               # JWT + bcrypt (register/login/GitHub OAuth)
│   │   ├── db.js                 # DB facade (SQLite ↔ Supabase)
│   │   ├── queue.js              # In-process scan queue with SSE progress
│   │   ├── store.js              # JSON persistence with DB fallback
│   │   ├── scan/                 # 9-phase engine, crawl, TLS, fingerprint, checks, verify, vision
│   │   └── ai/                   # Multi-provider AI chain with local fallback, VibeCheck
│   ├── supabase.sql              # PostgreSQL schema
│   └── railway.json              # Railway deployment config
├── render.yaml                   # Render.com blueprint
├── vercel.json                   # Vercel config with API proxy
├── submission.md                 # Hackathon submission document
└── package.json                  # npm workspaces (web + server)
```

---

## License

MIT — free to use, modify, and deploy.

> **Important:** Use SiteAudit only on websites you own or have explicit written permission to test. Unauthorized scanning is illegal in most jurisdictions. Consent is recorded with timestamp and IP for every scan.
