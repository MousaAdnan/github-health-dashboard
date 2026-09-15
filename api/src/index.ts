import "dotenv/config";
import express from "express";
import cors from "cors";
import reposRouter from "./routes/repos";
import ingestRouter from "./routes/ingest";

const app  = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/repos",  reposRouter);
app.use("/api/ingest", ingestRouter);

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
