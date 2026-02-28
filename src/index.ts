import express from "express";
import cors from "cors";
import path from "node:path";
import { z } from "zod";
import { config, assertSpeechConfig } from "./config.js";
import { generateScript } from "./services/scriptGenerator.js";
import { createEpisode, runEpisodePipeline } from "./services/podcastPipeline.js";
import { episodeStore } from "./services/episodeStore.js";
import { chunkTurns } from "./services/chunker.js";
import { apiCorsOptions, requireApiAuth } from "./services/auth.js";

const app = express();

app.use(cors(apiCorsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.resolve(process.cwd(), "client", "dist")));
app.use("/scripts", requireApiAuth);
app.use("/episodes", requireApiAuth);

const scriptGenSchema = z.object({
  topic: z.string().min(3),
  title: z.string().optional(),
  tone: z.string().optional(),
  targetMinutes: z.number().int().min(1).max(60).optional()
});

const turnSchema = z.object({
  speaker: z.enum(["A", "B"]),
  text: z.string().min(1)
});

const episodeSchema = z.object({
  title: z.string().optional(),
  script: z.array(turnSchema).min(2),
  introMusicUrl: z.string().url().startsWith("https://").optional(),
  outroMusicUrl: z.string().url().startsWith("https://").optional()
});

app.post("/scripts/generate", async (req, res) => {
  const parsed = scriptGenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const generated = await generateScript(parsed.data);
  return res.status(200).json(generated);
});

app.post("/episodes", async (req, res) => {
  const parsed = episodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    assertSpeechConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Speech config missing";
    return res.status(400).json({ error: message });
  }

  const episode = await createEpisode(parsed.data);
  const expectedJobs = chunkTurns(parsed.data.script).map(
    (_chunk, index) => `${episode.id}-c${String(index + 1).padStart(2, "0")}`
  );

  void runEpisodePipeline(episode.id, parsed.data);

  return res.status(202).json({
    episodeId: episode.id,
    jobIds: expectedJobs,
    status: episode.status
  });
});

app.get("/episodes/:id", async (req, res) => {
  const episode = await episodeStore.get(req.params.id);
  if (!episode) {
    return res.status(404).json({ error: "Episode not found" });
  }

  return res.status(200).json(episode);
});

app.get("/episodes/:id/audio", async (req, res) => {
  const episode = await episodeStore.get(req.params.id);
  if (!episode?.finalLocalPath) {
    return res.status(404).json({ error: "Audio not available" });
  }

  return res.sendFile(path.resolve(episode.finalLocalPath));
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(config.port, () => {
  console.log(`PodcastGen listening on http://localhost:${config.port}`);
});
