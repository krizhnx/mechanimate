import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { askTutor, checkStep, DEFAULT_MODEL, MODELS, solveQuestion } from "./gemma";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY), model: DEFAULT_MODEL, models: MODELS });
});

app.post("/api/solve", async (req, res) => {
  const started = Date.now();
  try {
    const { imageBase64, mimeType, text, model, thinking, verifyLoop } = req.body ?? {};
    const out = await solveQuestion({ imageBase64, mimeType, text, model, thinking, verifyLoop });
    console.log(`[solve] ${out.meta.model} ${out.spec.topic} "${out.spec.title}" in ${out.meta.ms}ms (attempts ${out.meta.attempts})`);
    res.json(out);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error(`[solve] failed after ${Date.now() - started}ms:`, msg);
    res.status(500).json({ error: msg });
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const out = await askTutor(req.body);
    res.json(out);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error("[ask] failed:", msg);
    res.status(500).json({ error: msg });
  }
});

app.post("/api/check", async (req, res) => {
  try {
    res.json(await checkStep(req.body));
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error("[check] failed:", msg);
    res.status(500).json({ error: msg });
  }
});

// production: serve the built frontend
const dist = path.resolve(__dirname, "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`Mechanimate API on http://localhost:${PORT}  (model: ${DEFAULT_MODEL}, key: ${process.env.GEMINI_API_KEY ? "set" : "MISSING"})`);
});
