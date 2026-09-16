import { Router, Request, Response } from "express";
import { getDb, rows } from "../db";

const router = Router();

// GET /api/repos/:owner
router.get("/:owner", async (req: Request, res: Response) => {
  try {
    const db    = await getDb();
    const owner = req.params.owner.toLowerCase();

    const repos = rows(db,
      `SELECT id, owner, name, description, language, stars, forks, last_pushed, health, fetched_at
       FROM repos WHERE lower(owner) = ? ORDER BY health DESC, stars DESC`,
      [owner]
    );

    if (!repos.length) {
      res.status(404).json({ error: "Owner not found. Run ingest first." });
      return;
    }

    const meta = rows<{ fetched_at: string }>(db,
      "SELECT fetched_at FROM owners WHERE lower(login) = ?", [owner]
    );

    res.json({ owner, fetched_at: meta[0]?.fetched_at ?? null, repos });
  } catch (err) {
    console.error("[repos]", err);
    res.status(500).json({ error: "Something went wrong looking up that owner." });
  }
});

// GET /api/repos/:owner/:repo
router.get("/:owner/:repo", async (req: Request, res: Response) => {
  try {
    const db  = await getDb();
    const rid = `${req.params.owner}/${req.params.repo}`;

    const repoRows = rows(db, "SELECT * FROM repos WHERE lower(id) = lower(?)", [rid]);
    if (!repoRows.length) {
      res.status(404).json({ error: "Repo not found." });
      return;
    }

    const commits = rows<{ week_start: string; count: number }>(db,
      `SELECT week_start, count FROM commits_weekly
       WHERE lower(repo_id) = lower(?) ORDER BY week_start ASC`,
      [rid]
    );

    const prs = rows<{ state: string; created_at: string; closed_at: string; merged_at: string }>(db,
      `SELECT state, created_at, closed_at, merged_at FROM pull_requests WHERE lower(repo_id) = lower(?)`,
      [rid]
    );

    const issues = rows<{ state: string; created_at: string; closed_at: string }>(db,
      `SELECT state, created_at, closed_at FROM issues WHERE lower(repo_id) = lower(?)`,
      [rid]
    );

    const closedPrs   = prs.filter(p => p.state === "closed");
    const mergedPrs   = closedPrs.filter(p => p.merged_at);
    const mergeTimes  = mergedPrs
      .filter(p => p.created_at && p.merged_at)
      .map(p => (new Date(p.merged_at).getTime() - new Date(p.created_at).getTime()) / 86_400_000);
    const avgMergeDays = mergeTimes.length
      ? Math.round(mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length * 10) / 10
      : null;

    const closedIss   = issues.filter(i => i.state === "closed");
    const openAgeDays = issues
      .filter(i => i.state === "open" && i.created_at)
      .map(i => (Date.now() - new Date(i.created_at).getTime()) / 86_400_000);
    const avgOpenDays = openAgeDays.length
      ? Math.round(openAgeDays.reduce((a, b) => a + b, 0) / openAgeDays.length)
      : null;

    res.json({
      repo: repoRows[0],
      commits,
      stats: {
        prs: {
          open:           prs.filter(p => p.state === "open").length,
          closed:         closedPrs.length,
          merged:         mergedPrs.length,
          avg_merge_days: avgMergeDays,
        },
        issues: {
          open:          issues.filter(i => i.state === "open").length,
          closed:        closedIss.length,
          avg_open_days: avgOpenDays,
        },
      },
    });
  } catch (err) {
    console.error("[repos]", err);
    res.status(500).json({ error: "Something went wrong looking up that repo." });
  }
});

export default router;
