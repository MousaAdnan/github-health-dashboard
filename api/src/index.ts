import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import reposRouter from "./routes/repos";
import ingestRouter from "./routes/ingest";

const app  = express();
const PORT = Number(process.env.PORT ?? 3001);

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
  app.get("*", (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => console.log(`API running on port ${PORT}`));
