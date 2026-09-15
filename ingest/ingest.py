#!/usr/bin/env python3
"""
GitHub Repository Health Ingest
Usage: python ingest.py <owner>
Env:   GITHUB_TOKEN  — optional, raises rate limit from 60 to 5000 req/hr
       DB_PATH       — path to SQLite file (default: ../data/health.db)
"""

import sys
import os
import json
import sqlite3
import ssl
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

# macOS ships without trusted CA certs for Python — use certifi if available,
# otherwise fall back to the system cert store; last resort: skip verification.
def _build_ssl_ctx() -> ssl.SSLContext:
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
        return ctx
    except ImportError:
        pass
    ctx = ssl.create_default_context()
    try:
        import subprocess, shutil
        brew_ca = subprocess.run(
            ["brew", "--prefix", "ca-certificates"], capture_output=True, text=True
        ).stdout.strip()
        ca_bundle = os.path.join(brew_ca, "share/ca-certificates/cacert.pem")
        if os.path.exists(ca_bundle):
            ctx.load_verify_locations(ca_bundle)
            return ctx
    except Exception:
        pass
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

SSL_CTX = _build_ssl_ctx()

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "../data/health.db"))
TOKEN   = os.environ.get("GITHUB_TOKEN", "")
BASE    = "https://api.github.com"


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def gh_request(path: str, retries: int = 3):
    url = f"{BASE}{path}"
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "github-health-dashboard/1.0")
    if TOKEN:
        req.add_header("Authorization", f"token {TOKEN}")

    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as resp:
                remaining = resp.headers.get("X-RateLimit-Remaining")
                if remaining and int(remaining) < 5:
                    print(f"  ⚠ rate limit low ({remaining} left), sleeping 15s...")
                    time.sleep(15)
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 404, None
            if e.code == 202:
                return 202, None  # GitHub computing stats; skip rather than block
            if e.code in (403, 429):
                reset = e.headers.get("X-RateLimit-Reset")
                wait  = max(int(reset) - int(time.time()) + 2, 10) if reset else 60
                if wait > 15:
                    print("RATE_LIMITED")
                    sys.exit(2)
                print(f"  ⚠ rate limit low, waiting {wait}s...")
                time.sleep(wait)
                continue
            return e.code, None
        except Exception as exc:
            print(f"  request error: {exc}")
            time.sleep(2)

    return 0, None


def paginate(path: str, per_page: int = 100, limit: int = 0):
    results = []
    page = 1
    sep = "&" if "?" in path else "?"
    while True:
        status, data = gh_request(f"{path}{sep}per_page={per_page}&page={page}")
        if status != 200 or not data:
            break
        results.extend(data)
        if limit and len(results) >= limit:
            return results[:limit]
        if len(data) < per_page:
            break
        page += 1
    return results


# ── Database ──────────────────────────────────────────────────────────────────

def init_db(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS repos (
            id          TEXT PRIMARY KEY,
            owner       TEXT NOT NULL,
            name        TEXT NOT NULL,
            description TEXT,
            language    TEXT,
            stars       INTEGER DEFAULT 0,
            forks       INTEGER DEFAULT 0,
            last_pushed TEXT,
            health      INTEGER DEFAULT 0,
            fetched_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS commits_weekly (
            repo_id    TEXT NOT NULL,
            week_start TEXT NOT NULL,
            count      INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (repo_id, week_start)
        );

        CREATE TABLE IF NOT EXISTS pull_requests (
            repo_id    TEXT NOT NULL,
            number     INTEGER NOT NULL,
            state      TEXT NOT NULL,
            created_at TEXT,
            closed_at  TEXT,
            merged_at  TEXT,
            PRIMARY KEY (repo_id, number)
        );

        CREATE TABLE IF NOT EXISTS issues (
            repo_id    TEXT NOT NULL,
            number     INTEGER NOT NULL,
            state      TEXT NOT NULL,
            created_at TEXT,
            closed_at  TEXT,
            PRIMARY KEY (repo_id, number)
        );

        CREATE TABLE IF NOT EXISTS owners (
            login      TEXT PRIMARY KEY,
            fetched_at TEXT NOT NULL
        );
    """)
    conn.commit()


# ── Health score ──────────────────────────────────────────────────────────────

def health_score(weekly: list[int], pr_merge_rate, issue_close_rate, days_since_push: int) -> int:
    # Commit activity: 0–40 pts
    if not weekly or all(w == 0 for w in weekly):
        commit_pts = 0.0
    else:
        recent_avg  = sum(weekly[-4:]) / 4
        overall_avg = sum(weekly) / len(weekly)
        ratio       = min(recent_avg / max(overall_avg, 0.1), 1.0)
        abs_score   = min(recent_avg / 5.0, 1.0)   # 5 commits/wk = full marks
        commit_pts  = 40.0 * (ratio * 0.6 + abs_score * 0.4)

    # PR merge rate: 0–25 pts (neutral 12.5 if no PRs)
    pr_pts = 25.0 * pr_merge_rate if pr_merge_rate is not None else 12.5

    # Issue close rate: 0–20 pts (neutral 10 if no issues)
    issue_pts = 20.0 * issue_close_rate if issue_close_rate is not None else 10.0

    # Recency: 0–15 pts
    recency_pts = max(0.0, 15.0 * (1.0 - days_since_push / 365.0))

    return min(100, round(commit_pts + pr_pts + issue_pts + recency_pts))


# ── Ingest one repo ───────────────────────────────────────────────────────────

def ingest_repo(conn: sqlite3.Connection, owner: str, repo: dict):
    rid = f"{owner}/{repo['name']}"
    now = datetime.now(timezone.utc).isoformat()

    # Commit activity (52 weeks)
    status, stats = gh_request(f"/repos/{rid}/stats/commit_activity")
    weekly = []
    if status == 200 and stats:
        weekly = [w["total"] for w in stats]   # oldest → newest

    # PRs — cap at 100 each to avoid unbounded fetching on large repos
    prs_open   = paginate(f"/repos/{rid}/pulls?state=open",   limit=100)
    prs_closed = paginate(f"/repos/{rid}/pulls?state=closed", limit=100)
    all_prs    = prs_open + prs_closed

    merged   = sum(1 for p in prs_closed if p.get("merged_at"))
    pr_rate  = (merged / len(prs_closed)) if prs_closed else None

    # Issues (excluding PRs) — cap at 100
    issues_raw = paginate(f"/repos/{rid}/issues?state=all&filter=all", limit=100)
    issues     = [i for i in issues_raw if "pull_request" not in i]
    closed_iss = [i for i in issues if i["state"] == "closed"]
    issue_rate = (len(closed_iss) / len(issues)) if issues else None

    # Days since last push
    pushed_at = repo.get("pushed_at") or repo.get("updated_at", now)
    pushed_dt = datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
    days_since = (datetime.now(timezone.utc) - pushed_dt).days

    score = health_score(weekly, pr_rate, issue_rate, days_since)

    # Write repo
    conn.execute("""
        INSERT OR REPLACE INTO repos
        (id, owner, name, description, language, stars, forks, last_pushed, health, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (rid, owner, repo["name"], repo.get("description"), repo.get("language"),
          repo.get("stargazers_count", 0), repo.get("forks_count", 0),
          pushed_at, score, now))

    # Write weekly commits
    if weekly:
        # last 52 weeks; compute Monday dates going back from today
        today  = datetime.now(timezone.utc).date()
        monday = today - timedelta(days=today.weekday())
        week_dates = [(monday - timedelta(weeks=51 - i)).isoformat() for i in range(52)]
        conn.executemany(
            "INSERT OR REPLACE INTO commits_weekly (repo_id, week_start, count) VALUES (?, ?, ?)",
            [(rid, d, c) for d, c in zip(week_dates, weekly[-52:])]
        )

    # Write PRs
    conn.executemany("""
        INSERT OR REPLACE INTO pull_requests (repo_id, number, state, created_at, closed_at, merged_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, [(rid, p["number"], p["state"], p.get("created_at"), p.get("closed_at"), p.get("merged_at"))
          for p in all_prs])

    # Write issues
    conn.executemany("""
        INSERT OR REPLACE INTO issues (repo_id, number, state, created_at, closed_at)
        VALUES (?, ?, ?, ?, ?)
    """, [(rid, i["number"], i["state"], i.get("created_at"), i.get("closed_at"))
          for i in issues])

    conn.commit()
    print(f"  ✓ {rid}  health={score}  commits_wks={len(weekly)}  prs={len(all_prs)}  issues={len(issues)}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python ingest.py <github-owner>")
        sys.exit(1)

    owner = sys.argv[1]
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn  = sqlite3.connect(DB_PATH)
    init_db(conn)

    print(f"Fetching repos for {owner}...")
    status, user_data = gh_request(f"/users/{owner}")
    if status == 404:
        print(f"USER_NOT_FOUND")
        sys.exit(1)

    MAX_REPOS = 30
    repos = paginate(f"/users/{owner}/repos?type=public&sort=pushed", limit=MAX_REPOS)
    note  = f" (capped at {MAX_REPOS} most-recently-pushed)" if len(repos) == MAX_REPOS else ""
    print(f"Found {len(repos)} public repos{note}. Ingesting...\n")

    for repo in repos:
        if repo.get("fork"):
            continue   # skip forks — not the owner's original work
        try:
            ingest_repo(conn, owner, repo)
        except Exception as exc:
            print(f"  ✗ {owner}/{repo['name']}: {exc}")

    conn.execute(
        "INSERT OR REPLACE INTO owners (login, fetched_at) VALUES (?, ?)",
        (owner, datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    conn.close()
    print(f"\nDone. Database: {os.path.abspath(DB_PATH)}")


if __name__ == "__main__":
    main()
