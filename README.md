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

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/repos/:owner` | List all repos for an owner, sorted by health score |
| `GET` | `/api/repos/:owner/:repo` | Detail: commits/week chart, PR stats, issue stats |
| `POST` | `/api/ingest/:owner` | Run the Python ingest for an owner |

## Why I Built This

I wanted a way to quickly audit the health of my own repos (and repos I contribute to) without clicking through GitHub's UI. A single score that rolls up commit cadence, PR hygiene, and issue resolution makes it easy to see where a project needs attention.
