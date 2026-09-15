import { Router, Request, Response } from "express";
import { execFile } from "child_process";
import path from "path";
import { invalidateDb } from "../db";

const router  = Router();
const INGEST  = path.join(__dirname, "../../../ingest/ingest.py");
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "../../../data/health.db");

// POST /api/ingest/:owner — run Python ingest script, wait for completion
router.post("/:owner", (req: Request, res: Response) => {
  const { owner } = req.params;

  const env = {
    ...process.env,
    DB_PATH,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? "",
  };

  // 90s timeout — enough for ~25 repos without a token
  const child = execFile(
    "python3",
    [INGEST, owner],
    { env, timeout: 90_000 },
    (err, stdout, stderr) => {
      if (err) {
        if (stdout.includes("USER_NOT_FOUND")) {
          res.status(404).json({ error: `No GitHub account found for '${owner}'.` });
          return;
        }
        if (stdout.includes("RATE_LIMITED")) {
          res.status(429).json({ error: "GitHub rate limit reached. Add a personal access token (no scopes needed) to raise the limit from 60 to 5,000 requests/hr." });
          return;
        }
        if (err.killed) {
          res.status(408).json({ error: `Analysis timed out — '${owner}' may have too many repos. Add a GitHub token to speed things up.` });
          return;
        }
        console.error("[ingest]", stderr.slice(0, 500));
        res.status(500).json({ error: "Ingest failed — check that the username is correct and try again." });
        return;
      }
      invalidateDb();
      res.json({ ok: true, owner, log: stdout });
    }
  );

  // Stream stdout so the terminal shows progress during development
  child.stdout?.pipe(process.stdout);
});

export default router;
