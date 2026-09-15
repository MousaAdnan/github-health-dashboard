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
        console.error(stderr);
        res.status(500).json({ error: err.message, detail: stderr.slice(0, 500) });
        return;
      }
      invalidateDb(); // force DB reload after Python writes new data
      res.json({ ok: true, owner, log: stdout });
    }
  );

  // Stream stdout so the terminal shows progress during development
  child.stdout?.pipe(process.stdout);
});

export default router;
