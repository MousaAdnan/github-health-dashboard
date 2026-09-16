import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { execFile } from "child_process";
import path from "path";
import { invalidateDb } from "../db";

const router  = Router();

// In the container the ingest script is copied to /app/ingest; locally it lives
// a few levels up from dist/routes. INGEST_SCRIPT lets the image say where.
const INGEST  = process.env.INGEST_SCRIPT ?? path.join(__dirname, "../../../ingest/ingest.py");
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "../../../data/health.db");

// Each ingest spawns a subprocess and burns real GitHub API quota on our token —
// cap it hard per IP so a public link can't be used to exhaust either.
const ingestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many analyses from this IP — please wait a few minutes and try again." },
});

let activeIngests = 0;
const MAX_CONCURRENT_INGESTS = 2;

// POST /api/ingest/:owner — run Python ingest script, wait for completion
router.post("/:owner", ingestLimiter, (req: Request, res: Response) => {
  const { owner } = req.params;

  if (activeIngests >= MAX_CONCURRENT_INGESTS) {
    res.status(503).json({ error: "Server is busy analyzing another request — please try again shortly." });
    return;
  }
  activeIngests++;

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
      activeIngests--;
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
