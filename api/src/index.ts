import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import reposRouter from "./routes/repos";
import ingestRouter from "./routes/ingest";

const app  = express();
const PORT = Number(process.env.PORT ?? 3001);

// Render (and most PaaS) put one proxy in front of the app. Without this,
// req.ip is the proxy's address, so the ingest rate limiter buckets every
// visitor together and starts 429-ing after five searches site-wide.
// A specific hop count rather than `true`, which would let anyone spoof
// X-Forwarded-For and bypass the limit entirely.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));

// In production, restrict to the deployed frontend's origin via CORS_ORIGIN.
// Falls back to allow-all only when unset (local dev, where origins vary).
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/repos",  reposRouter);
app.use("/api/ingest", ingestRouter);

// In the deployed container the built React app sits next to dist/ and is served
// from this same process, so the whole thing is one service on one origin.
// Locally it doesn't exist — Vite's dev server proxies /api here instead.
const CLIENT_DIST = process.env.CLIENT_DIST ?? path.join(__dirname, "../public");
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));

  // An unmatched /api/* path must never fall through to index.html: the client
  // would receive HTML with status 200 and throw a JSON parse error instead of
  // showing the real problem.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "No such API endpoint." });
  });

  app.get("*", (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
}

// Return JSON, not Express's default HTML error page, when a route throws.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, "0.0.0.0", () => console.log(`API running on port ${PORT}`));
