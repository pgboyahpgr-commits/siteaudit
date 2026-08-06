# Deployment (Zero Budget) — live status

The full stack is deployed and running on free tiers:

| Tier | URL |
|------|-----|
| **Frontend** (Vercel) | `https://siteaudit-six.vercel.app` |
| **API** (Render) | `https://siteaudit-backend-k96o.onrender.com` |
| **Database** (Supabase Postgres) | managed project, `aws-0-ap-south-1` pooler |
| **GitHub** | `https://github.com/pgboyahpgr-commits/siteaudit` |

Verified working end-to-end on the live stack: `/api/health` → `{"ok":true}`,
register → `/api/me` (reports `db: "supabase"`), save scan → `/api/my/scans`,
`/api/verify/config` (6 methods), Vercel `/api/*` proxy → Render, and the
production JS bundle bakes `https://siteaudit-backend-k96o.onrender.com/api`.

---

## 1. Frontend -> Vercel

```powershell
cd web
$env:VITE_API_URL="https://siteaudit-backend-k96o.onrender.com/api"
npm run build
vercel --prod --yes
```

- `web/vercel.json` does SPA rewrites and **proxies `/api/*` to the Render API**,
  so same-origin requests work even without a baked URL.
- `VITE_API_URL` is also stored as a Vercel **Production** env var so CI/auto
  deploys bake the correct API origin.
- Custom domain optional; `*.vercel.app` is fine.

## 2. API Server -> Render (web service)

- Repo-based deploy (Render pulls from GitHub, `rootDir: server`).
- `buildCommand: npm ci --omit=dev`
- `startCommand: node --env-file-if-exists=.env src/index.js`
- `healthCheckPath: /api/health`, plan `free`, region `oregon`.
- Env vars set on the service (see below). `JWT_SECRET` must be a long random
  string; `CORS_ORIGIN` lists `http://localhost:5173,https://siteaudit-*.vercel.app`.
- Render free tier sleeps after ~15 min idle; first request wakes it (~5–30s).
- To redeploy via API: `POST /v1/services/<id>/deploys` with a Render API key.

`server/render.yaml` + `server/railway.json` are provided as blueprints for
recreating the service on Render or Railway.

## 3. Database -> Supabase (Postgres)

- Create a free project; the server auto-creates the schema on first query
  (idempotent `CREATE TABLE IF NOT EXISTS`), or run `server/supabase.sql` once
  in the Supabase SQL editor.
- Set `DATABASE_URL` (use the **session pooler** string for Node):
  `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
- If the direct `db.<ref>.supabase.co` host only has IPv6, use the pooler host.
- `server/src/db.js` is a facade: SQLite (`db-sqlite.js`) when `DATABASE_URL` is
  unset, Postgres (`db-supabase.js`) when set. `/api/me` returns `db` kind.

## 4. Required env vars (API)

```
PORT=10000
JWT_SECRET=<long-random-string>
CORS_ORIGIN=http://localhost:5173,https://siteaudit-*.vercel.app
AI_PROVIDER=gemini,xai,completions,mistral,nim,openai,anthropic,lmstudio
GEMINI_API_KEY=<key>          GEMINI_MODEL=gemini-2.5-flash
XAI_API_KEY=<key>             # optional; needs credits at console.x.ai
COMPLETIONS_API_KEY=<key>     # optional fallback
YT_SEARCH_API=https://ytapis.djalokyt27.workers.dev
SCREENSHOT_API=https://image.thum.io/get/width
DATABASE_URL=<supabase pooler url>
```

## 5. Connectivity Matrix

| From | To | How |
|------|----|-----|
| Browser | Frontend | Vercel CDN |
| Frontend | API | baked `VITE_API_URL` **and** `vercel.json` `/api/*` rewrite |
| API | Supabase | `DATABASE_URL` pooler connection |
| API | AI providers | server-side keys only |
| API | Target sites | direct outbound HTTP/HTTPS |

## 6. Cost Recap

| Item | Cost |
|------|:----:|
| Vercel Hobby | $0 |
| Render free web service | $0 |
| Supabase free tier (Postgres) | $0 |
| GitHub (public repo) | $0 |
| **Total** | **$0/month** |

## 7. Deploy Checklist (live)

- [x] Frontend on Vercel: `https://siteaudit-six.vercel.app`
- [x] API on Render: `https://siteaudit-backend-k96o.onrender.com`
- [x] DB on Supabase (Postgres), schema created, `db: supabase` confirmed
- [x] CORS allowlist includes the Vercel origin
- [x] `/api/*` proxy rewrite on Vercel → Render
- [x] `VITE_API_URL` baked into production bundle
- [x] Health check `{"ok":true}` from both origins
