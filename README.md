# GitHub Repository Health Dashboard

Enter a GitHub username and get a 0 to 100 health score for each of their public repositories, based on commit activity, pull request merges, issue resolution, and how recently the code was pushed.

**Live demo:** https://github-health-o1me.onrender.com/ (free hosting, so the first load after a period of inactivity takes about 50 seconds)

## Why I Built This

I wanted to contribute to open source projects but kept finding projects that had been abandoned. This is a quick way to figure out if a repo is active without manually going through accounts and commits.

## How It Works

1. You search for a GitHub owner in the web app.
2. If that owner isn't in the database yet, the API runs the Python ingest script (`ingest/ingest.py`).
3. The script pulls repository, commit, pull request, and issue data from the GitHub REST API, computes a health score for each repo, and saves everything to a SQLite database.
4. The API reads from that database and the React client shows a ranked list of repos, with a detail view for each one (weekly commit chart, PR stats, issue stats).

```
GitHub REST API
      │
      ▼
ingest/ingest.py ──writes──▶ SQLite (health.db) ◀──reads── api/ (Express) ◀──── client/ (React)
      ▲                                                        │
      └──────────────── runs on POST /api/ingest/:owner ───────┘
```

## Health Score

Each repo is scored out of 100 across four categories:

| Category | Points | How it's calculated |
|---|---|---|
| Commit activity | 40 | 60% compares the last 4 weeks of commits to the 52-week average (is activity holding up or dropping off?); 40% rewards absolute recent volume, with full marks at 5+ commits per week |
| PR merge rate | 25 | Share of closed pull requests that were merged. Repos with no closed PRs get a neutral 12.5 |
| Issue close rate | 20 | Share of issues that are closed (pull requests are excluded). Repos with no issues get a neutral 10 |
| Recency | 15 | Full marks if pushed today, decreasing linearly to 0 at 365 days since the last push |

The neutral scores keep small personal projects, which often have no PRs or issues at all, from being punished for something that doesn't apply to them.

## Tech Stack

| Part | Technology |
|---|---|
| Ingest | Python 3 (standard library only: `urllib`, `sqlite3`, `concurrent.futures`) |
| Database | SQLite |
| API | Node.js, Express, TypeScript, sql.js |
| Client | React, TypeScript, Vite, Recharts |
| Deployment | Docker, nginx (Compose setup), Render |

## Project Structure

```
ingest/
  ingest.py            Fetches GitHub data, scores repos, writes to SQLite
api/src/
  index.ts             Express server; also serves the built client in production
  db.ts                Loads the SQLite file through sql.js
  routes/repos.ts      Read endpoints for owners and repos
  routes/ingest.ts     Runs ingest.py as a subprocess, with rate limiting
client/src/
  App.tsx              Search, loading, repo list, and repo detail views
  api.ts               Typed fetch client
  components/          RepoList, RepoDetail, HealthBadge
Dockerfile             Single-image production build (used on Render)
docker-compose.yml     Separate api, client, and ingest containers for local use
```

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.10+
- Optional: a GitHub personal access token. With no scopes selected it can still read public repos, and it raises GitHub's rate limit from 60 to 5,000 requests per hour. Without one you'll only be able to analyze a few owners per hour.

### Run locally

```bash
# 1. Add your token (optional)
cp .env.example .env
# then set GITHUB_TOKEN=... in .env

# 2. Install dependencies
cd api && npm install
cd ../client && npm install

# 3. Start the API on port 3001
cd ../api && npm run dev

# 4. In a second terminal, start the client on port 5173
cd client && npm run dev
```

Open http://localhost:5173, enter a GitHub username, and press **Search**. The Vite dev server forwards `/api` requests to the API on port 3001.

### Run with Docker Compose

```bash
cp .env.example .env              # add GITHUB_TOKEN if you have one
docker compose up --build         # API on :3001, client on :5173
```

You can also run the ingest step on its own, without the web app:

```bash
docker compose run --rm ingest <github-username>
```

### Run the ingest script directly

The ingest script has no third-party dependencies, so it runs with any Python 3 install:

```bash
GITHUB_TOKEN=your_token python3 ingest/ingest.py <github-username>
```

By default it writes to `data/health.db`. Set `DB_PATH` to write somewhere else.

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check, returns `{ "ok": true }` |
| `GET` | `/api/repos/:owner` | All of an owner's ingested repos, sorted by health score |
| `GET` | `/api/repos/:owner/:repo` | One repo's details: weekly commits, PR stats (including average days to merge), and issue stats (including average age of open issues) |
| `POST` | `/api/ingest/:owner` | Runs the ingest script for an owner and waits for it to finish |

`POST /api/ingest/:owner` is limited to 5 requests per IP every 15 minutes and 2 ingests running at once, since each run uses real GitHub API quota.

## Configuration

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` | ingest, API | empty | Raises the GitHub rate limit to 5,000 requests per hour |
| `DB_PATH` | ingest, API | `data/health.db` | Location of the SQLite database |
| `INGEST_WORKERS` | ingest | `6` | Number of repos fetched in parallel |
| `CORS_ORIGIN` | API | allow all | Restricts which site can call the API in production |
| `PORT` | API | `3001` | Port the API listens on |

## Design Notes

- **Parallel fetching, single-threaded writes.** Each repo needs four GitHub requests that mostly wait on the network, so fetching 30 repos one at a time took about two minutes. The script fetches up to 6 repos at once on a thread pool, but only writes to SQLite from the main thread, because SQLite connections aren't safe to share between threads.
- **Rate-limit handling.** When fewer than 5 requests remain, the script pauses for 15 seconds. If GitHub returns a rate-limit error and the reset is more than 15 seconds away, the script stops and the API tells the user to add a token instead of hanging. Network errors are retried up to 3 times.
- **SQLite as a cache on Render.** Render's free tier has no persistent disk, so the deployed database lives in `/tmp` and is rebuilt on demand. Losing it on a restart only means the next search for an owner re-runs the ingest.

## Limitations

- Only the 30 most recently pushed public repos per owner are analyzed, and forks are skipped.
- Pull requests and issues are capped at the 100 most recent per repo, so very large projects are scored on a recent sample.
- GitHub computes commit statistics in the background. The first time a repo is requested, GitHub may not have them ready yet, in which case the repo gets 0 commit points until it is ingested again.
