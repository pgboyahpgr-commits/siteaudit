# SiteAudit — AI-Powered Security & Trust Scanner

## One-Liner
Paste any URL. SiteAudit reverse-engineers the entire site, finds vulnerabilities, secrets, exposed endpoints, and CVE matches — then tells you exactly how to fix everything. All with AI, zero signup required.

## What It Does

SiteAudit is a full-stack web security platform that combines an 8-phase scan engine with multi-provider AI analysis. It crawls pages, probes 90+ exposed paths, reverse-engineers API endpoints, scans source code for 18+ secret patterns, matches detected technologies against 22 CVEs, and generates AI-powered plain-English reports with fix instructions.

### Core Features

**9-Phase Web Scanner**
- Discovery (crawl up to 50 pages, robots.txt analysis)
- Fingerprint (detect 40+ technologies with version extraction)
- Header Audit (CSP, HSTS, XFO, CORS, cookies, cache-control)
- TLS Analysis (handshake, certificate, protocol version, SANs)
- Enumeration (90+ exposed paths, directory listings, source maps)
- Endpoint Reverse-Engineering (API route discovery, auth checks)
- Source Review (18 secret patterns, email leaks, mixed content, CSRF forms)
- CVE Matching (22 entries covering React, Next.js, Express, Nginx, WP, etc.)
- Active Probes (Full Check mode: SQLi, XSS, CSRF, open redirect tests)

**AI Analysis**
- Multi-provider chain: LM Studio (local) → Gemini → xAI → Completions → Pollinations (guaranteed fallback)
- VibeCheck: 0-100 trust score detecting template scaffolds, placeholder content, free proxies, hardcoded demo data
- AI Site Story: Auto-generated narrative summary of scan results
- AI Security Advisor: Per-scan chat grounded in actual findings
- Reversiy: Floating AI companion on every page with local deterministic fallback

**15-Engine Deep Scan (Client-Side)**
JS Bundle Analysis, CSS Quality, Auto CSP Generator, Email Security (SPF/DKIM/DMARC), Security.txt Generator, Broken Resource Hunter, Semantic HTML Audit, Meta Tag Completeness, Structured Data (JSON-LD), DOM Complexity, Third-Party Risk, Subresource Integrity, Web Vitals Estimator, Accessibility Audit, Link Health

**AI Image Detector (100% Client-Side)**
- C2PA provenance metadata scanning (9 markers, 20+ generator names)
- EXIF & camera metadata analysis (16 AI tool indicators)
- SynthID DCT frequency domain watermark detection
- 8 visual heuristic engines (noise, edges, colors, patterns, chromatic, coherence, blockiness, detail consistency)
- WebGPU deep learning classifier (ai-source-detector-ONNX)
- Error Level Analysis (ELA) forensic edit detection
- Weighted consensus verdict engine cross-referencing all signals

**Additional Tools**
- URL Engineer: Decompose URLs, follow redirect chains, detect tracking params, safety checks
- Side-by-Side Comparison: Your site vs competitor with diff visualization
- Scan History: localStorage persistence, compare two scans
- Onboarding Tour: 7-step interactive walkthrough
- Dark/Light mode toggle
- Export: JSON, CSV, HTML, Markdown, PDF, Share as Image, Embed Badge (SVG)

## Architecture

```
Frontend (React + Vite) → Vercel
       ↓ /api/*
Backend (Node.js + Express) → Render
       ↓
SQLite / Supabase PostgreSQL (dual-mode with auto-failover)
       ↓
AI Provider Chain: LM Studio → Gemini → xAI → Completions → Pollinations
```

- Monorepo: npm workspaces (web/ + server/)
- Auth: JWT + bcrypt (email/password) + GitHub OAuth
- Zero external API cost: Pollinations AI (free), LM Studio (local), all client-side engines
- Responsive: 4 breakpoints (860px, 720px, 520px, 380px)
- Code splitting: 4 separate bundles (main 772KB + 3 lazy chunks)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, React Router 6, Recharts |
| Backend | Node.js 22+, Express 5, Zod |
| Auth | JWT, bcrypt, GitHub OAuth |
| AI/ML | HuggingFace Transformers (ONNX/WebGPU), Pollinations AI, Gemini, xAI |
| Database | SQLite (node:sqlite) / Supabase PostgreSQL (pg) |
| Deployment | Vercel (frontend) + Render (backend) |
| Fonts | JetBrains Mono, Inter, Space Grotesk |

## Privacy & Security

- Zero user tracking, no analytics, no ads
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with configurable expiry
- All AI Image Detector processing is 100% client-side — images never leave the browser
- Consent logging for legal compliance
- Scan data stored in DB with JSON backup for persistence

## Team

Solo hackathon project — built from scratch.

## Try It

**https://siteaudit-six.vercel.app**

Paste any URL and click RUN SCAN. No signup required.
