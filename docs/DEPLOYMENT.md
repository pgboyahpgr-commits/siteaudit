# Deployment (Zero Budget)

Deploy the full stack using free tiers. You will need accounts for **Vercel**,
**Railway** (or Render), and **GitHub**. All are free.

---

## 0. Prerequisites

```powershell
# Install CLIs
npm i -g vercel
npm i -g @railway/cli
npm i -g @vercel/ncc       # optional, for bundling the worker

# GitHub CLI
winget install GitHub.cli
gh auth login               # once
```

Do these **once yourself** (browser auth — the agent cannot log you in):
```powershell
vercel login
railway login
```

---

## 1. Frontend -> Vercel

```powershell
cd web
npm run build                      # produces dist/
vercel --prod
```

Notes:
- Connect repo for automatic deploy-on-push: `vercel link` then push to GitHub.
- Custom domain optional; `*.vercel.app` is fine.
- Environment: none needed (frontend talks to API via `VITE_API_URL`).

`web/.env.production`:
```
VITE_API_URL=https://<your-api>.railway.app
```

---

## 2. API Server -> Railway

```powershell
cd server
railway init                       # link project
railway add                        # create volume for SQLite data persistence
railway up
railway domain                     # get public URL, e.g. https://api-production.up.railway.app
```

Set env vars in Railway dashboard:
```
PORT=4000
DATABASE_PATH=/data/siteaudit.db   # on the volume
INTERNAL_API_KEY=<generate-strong-key>
SCAN_QUEUE_TIMEOUT_MS=600000
```

Notes:
- Railway free tier sleeps after inactivity; wake on first request (adds ~1s latency).
- Use the **volume** so SQLite persists across restarts.
- Alternative host: **Render** free web service (same shape: `render.yaml` provided).

### `render.yaml` (alternative)
```yaml
services:
  - type: web
    name: siteaudit-api
    runtime: node
    plan: free
    buildCommand: npm run build --workspace=server
    startCommand: npm start --workspace=server
    envVars:
      - key: PORT
        value: 4000
      - key: INTERNAL_API_KEY
        generateValue: true
    disk:
      name: sqlite-data
      mountPath: /data
```

---

## 3. Scanner Worker

The worker needs CPU + the scanner binaries, so it does **not** live on Vercel/Railway.

### Option A — GitHub Codespaces (recommended to start)
- Check in `devcontainer.json` that installs scanner tools (see
  [SCANNER-ENGINE.md](SCANNER-ENGINE.md)).
- Open the Codespace, run `npm start --workspace=scanner` to start the worker loop.
- Free quota: 120 core-hours/month — fine for occasional scans.
- Limitation: stops after ~30 min idle; restart it before scanning.

### Option B — Oracle Always Free VM (recommended for production)
- Create a free Oracle Cloud "Always Free" ARM VM (4 vCPU, 24 GB RAM).
- Install Node + scanner tools.
- Run worker as a systemd service:
```ini
# /etc/systemd/system/siteaudit-worker.service
[Unit]
Description=SiteAudit Scanner Worker
[Service]
ExecStart=/usr/bin/node /home/siteaudit/scanner/worker.js
Environment=API_URL=https://<your-api>.railway.app
Environment=INTERNAL_API_KEY=<same-key>
Restart=always
[Install]
WantedBy=multi-user.target
```
- `sudo systemctl enable --now siteaudit-worker`

### Option C — GitHub Actions (scheduled / one-shot)
Run the scanner as a job that boots, scans, uploads the report, and exits:
```yaml
# .github/workflows/rescan.yml
on:
  schedule:
    - cron: "0 3 * * *"   # daily 03:00 UTC
  workflow_dispatch: {}

jobs:
  rescan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install tools
        run: ./scripts/install-tools.sh
      - name: Rescan verified targets
        run: node scanner/cli.js --from-db --report --upload
        env:
          API_URL: ${{ secrets.API_URL }}
          INTERNAL_API_KEY: ${{ secrets.INTERNAL_API_KEY }}
```

---

## 4. Connectivity Matrix

| From | To | How |
|------|----|-----|
| Browser | Frontend | Vercel CDN |
| Frontend | API | `VITE_API_URL`, CORS allowlist |
| API | SQLite | local volume `/data` |
| Worker | API | `POST /internal/jobs/claim` with `INTERNAL_API_KEY` |
| API | Target sites | direct outbound HTTP |
| Cron | API | `POST /scan/reschedule` with key |

Enable CORS on the API for your Vercel domain only.

---

## 5. Scheduled Re-Scans

- Set a GitHub Actions cron as in Option C, or
- Use the free-tier cron on your VM (`crontab -e`):
```
0 3 * * * cd /home/siteaudit/scanner && node cli.js --from-db --report --upload
```

---

## 6. Cost Recap

| Item | Cost |
|------|:----:|
| Vercel Hobby | $0 |
| Railway Trial / Render Free | $0 |
| Codespaces / Oracle VM | $0 |
| GitHub Actions | $0 (within 2,000 min/mo) |
| Database | $0 (SQLite) |
| Domain | $0 (`*.vercel.app` / `*.railway.app`) |
| **Total** | **$0/month** |

---

## 7. Deploy Checklist

- [ ] `vercel login`, `railway login`, `gh auth login` done once
- [ ] API env vars set (PORT, DATABASE_PATH, INTERNAL_API_KEY)
- [ ] CORS allowlist updated
- [ ] Worker VM created + tools installed + service enabled
- [ ] Frontend `VITE_API_URL` points at the API
- [ ] First end-to-end test: paste URL -> passive scan -> verify -> full check
