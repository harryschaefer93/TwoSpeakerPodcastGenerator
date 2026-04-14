import express from "express";
import cors from "cors";
import path from "node:path";
import { z } from "zod";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { config, assertSpeechConfig } from "./config.js";
import { generateScript, extractThemes } from "./services/scriptGenerator.js";
import { createEpisode, runEpisodePipeline } from "./services/podcastPipeline.js";
import { episodeStore } from "./services/episodeStore.js";
import { chunkTurns } from "./services/chunker.js";
import { apiCorsOptions, requireApiAuth } from "./services/auth.js";
import { processDocument, isSupportedMimeType } from "./services/documentProcessor.js";
import { sourceStore } from "./services/sourceStore.js";

const app = express();

app.use(cors(apiCorsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.resolve(process.cwd(), "client", "dist")));
app.use("/scripts", requireApiAuth);
app.use("/episodes", requireApiAuth);
app.use("/documents", requireApiAuth);

/* ------------------------------------------------------------------ */
/*  File upload (multer — in-memory, 20 MB cap)                       */
/* ------------------------------------------------------------------ */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isSupportedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted: PDF, plain text.`));
    }
  },
});

const scriptGenSchema = z.object({
  topic: z.string().min(3),
  title: z.string().optional(),
  tone: z.string().optional(),
  targetMinutes: z.number().int().min(1).max(60).optional(),
  documentId: z.string().uuid().optional(),
  themes: z.array(z.string()).optional()
});

const themesSchema = z.object({
  documentId: z.string().uuid()
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

/* ------------------------------------------------------------------ */
/*  Document upload                                                   */
/* ------------------------------------------------------------------ */

app.post("/documents/upload", (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  try {
    const result = await processDocument(req.file.buffer, req.file.mimetype);
    const id = uuidv4();

    await sourceStore.insert({
      id,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      extractedText: result.text,
      charCount: result.charCount,
      pageCount: result.pageCount,
      uploadedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      documentId: id,
      filename: req.file.originalname,
      charCount: result.charCount,
      pageCount: result.pageCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed";
    return res.status(400).json({ error: message });
  }
});

/* ------------------------------------------------------------------ */
/*  Document retrieval                                                */
/* ------------------------------------------------------------------ */

app.get("/documents", async (_req, res) => {
  const docs = await sourceStore.list();
  return res.status(200).json({
    documents: docs.map((d) => ({
      documentId: d.id,
      filename: d.filename,
      charCount: d.charCount,
      pageCount: d.pageCount,
      uploadedAt: d.uploadedAt,
    })),
  });
});

app.get("/documents/:id", async (req, res) => {
  const doc = await sourceStore.get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found" });
  return res.status(200).json({
    documentId: doc.id,
    filename: doc.filename,
    charCount: doc.charCount,
    pageCount: doc.pageCount,
    extractedText: doc.extractedText,
  });
});

/* ------------------------------------------------------------------ */
/*  Themes extraction                                                 */
/* ------------------------------------------------------------------ */

app.post("/scripts/themes", async (req, res) => {
  const parsed = themesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const doc = await sourceStore.get(parsed.data.documentId);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const themes = await extractThemes(doc.extractedText);
  return res.status(200).json({ themes });
});

/* ------------------------------------------------------------------ */
/*  Script generation                                                 */
/* ------------------------------------------------------------------ */

app.post("/scripts/generate", async (req, res) => {
  const parsed = scriptGenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  let sourceText: string | undefined;
  if (parsed.data.documentId) {
    const doc = await sourceStore.get(parsed.data.documentId);
    if (!doc) return res.status(404).json({ error: "Source document not found" });
    sourceText = doc.extractedText;
  }

  const generated = await generateScript({
    ...parsed.data,
    sourceText,
  });
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

void sourceStore.cleanupOlderThan(24).then((n) => {
  if (n > 0) console.log(`[startup] Cleaned up ${n} source document(s) older than 24h`);
});

app.listen(config.port, () => {
  console.log(`PodcastGen listening on http://localhost:${config.port}`);
});
