# GitHub Repository Health Dashboard

A self-hosted tool that ingests GitHub repository metrics and surfaces a health score per repo. Built to answer the question: *"how active and well-maintained is this codebase?"*

## Health Score (0–100)

| Category | Max | Signal |
|---|---|---|
| Commit activity | 40 | Commits in the last 52 weeks, scaled to ≥20 active weeks |
| PR merge rate | 25 | % of closed PRs that were merged |
| Issue close rate | 20 | % of issues that are closed |
| Recency | 15 | Days since last push (0 if > 365 days) |

## Architecture

```
ingest/ (Python, stdlib only)
  └── ingest.py          → fetches GitHub API, writes SQLite DB

api/ (Node + TypeScript + Express)
  └── src/
      ├── index.ts        → Express server (port 3001)
      ├── db.ts           → sql.js wrapper (pure WASM SQLite)
      └── routes/
          ├── repos.ts    → GET /api/repos/:owner, GET /api/repos/:owner/:repo
          └── ingest.ts   → POST /api/ingest/:owner

client/ (React + TypeScript + Vite + Recharts)
  └── src/
      ├── App.tsx         → 4-state UI: home → loading → list → detail
      ├── api.ts          → typed fetch client
      └── components/
          ├── RepoList.tsx
          ├── RepoDetail.tsx
          └── HealthBadge.tsx
```

## Quick Start (dev)

```bash
# 1 — copy env
cp .env.example .env
# optional: add your GitHub token for 5,000 req/hr vs. 60

# 2 — install deps
cd api && npm install
cd ../client && npm install

# 3 — start API (port 3001)
cd ../api && npm run dev

# 4 — start client (port 5173) in another terminal
cd ../client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173), type a GitHub username, and hit **Search**.

## Docker

```bash
cp .env.example .env          # add GITHUB_TOKEN if you have one
docker compose up --build     # api on :3001, client on :5173
```

## Deploy (free)

The whole app — React build, Express API and the Python ingest — ships as one
Docker image (`./Dockerfile`), so it runs as a single service on one URL.

1. Push this repo to GitHub.
2. On [render.com](https://render.com), **New → Blueprint**, point it at the repo.
   Render reads `render.yaml` and creates a free Docker web service.
3. In the service's **Environment** tab add `GITHUB_TOKEN` (a classic token with
   no scopes). Without it the public demo shares one 60 req/hr limit with every
   visitor.
4. Deploy. The app is live at `https://<service-name>.onrender.com`.

**Keeping it warm.** Render's free tier sleeps a service after 15 minutes idle,
and the next visitor waits ~50s for a cold start. Point a free scheduler such as
[cron-job.org](https://cron-job.org) at `https://<service>.onrender.com/api/health`
every 10 minutes and it stays awake. One always-on free service uses ~730 of the
750 monthly instance hours, so run exactly one.

**State.** The free tier has no persistent disk, so the SQLite file lives at
`/tmp/health.db` and is lost on restart. Ingest rebuilds it on demand, so it
behaves as a cache rather than a database of record.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/repos/:owner` | List all repos for an owner, sorted by health score |
| `GET` | `/api/repos/:owner/:repo` | Detail: commits/week chart, PR stats, issue stats |
| `POST` | `/api/ingest/:owner` | Run the Python ingest for an owner |

## Why I Built This

I wanted to contribute to open source projects but kept finding projects that had been abandoned. This is a quick way to figure out if a repo is active without manually going through accounts and commits.
