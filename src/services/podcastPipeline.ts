import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import type { EpisodeRecord, EpisodeRequest } from "../types.js";
import { episodeStore } from "./episodeStore.js";
import { chunkTurns } from "./chunker.js";
import { buildSsml, defaultVoiceConfig } from "./ssml.js";
import {
  createBatchSynthesisJob,
  waitForBatchJob,
  type BatchSynthesisJob
} from "./speechBatchClient.js";
import { resolveBatchResultUrl, downloadFile, uploadFinalAudio } from "./storage.js";
import { stitchAudio } from "./stitcher.js";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

const extractFirstAudio = async (zipFilePath: string, outputDir: string): Promise<string> => {
  const zip = new AdmZip(zipFilePath);
  const entries = zip.getEntries();
  const audioEntry = entries.find((entry) => /\.(mp3|wav|ogg|opus)$/i.test(entry.entryName));

  if (!audioEntry) {
    throw new Error(`No audio file found in ${zipFilePath}`);
  }

  await ensureDir(outputDir);
  const outputPath = path.join(outputDir, path.basename(audioEntry.entryName));
  await fs.writeFile(outputPath, audioEntry.getData());
  return outputPath;
};

const createRecord = (episodeId: string, request: EpisodeRequest): EpisodeRecord => ({
  id: episodeId,
  title: request.title || `Episode ${episodeId}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: "Queued",
  script: request.script,
  speechJobIds: [],
  chunkCount: 0
});

export const createEpisode = async (request: EpisodeRequest): Promise<EpisodeRecord> => {
  const episodeId = uuidv4();
  const record = createRecord(episodeId, request);
  await episodeStore.insert(record);
  return record;
};

const processChunkJobs = async (
  episodeId: string,
  request: EpisodeRequest,
  chunkSsmls: string[]
): Promise<string[]> => {
  const jobIds: string[] = [];
  const audioPaths: string[] = [];
  const outDir = path.join(config.paths.tmpDir, episodeId, "chunks");
  await ensureDir(outDir);

  for (let i = 0; i < chunkSsmls.length; i += 1) {
    const jobId = `${episodeId}-c${String(i + 1).padStart(2, "0")}`;
    jobIds.push(jobId);
    await createBatchSynthesisJob(jobId, [chunkSsmls[i]]);
  }

  await episodeStore.update(episodeId, {
    speechJobIds: jobIds,
    chunkCount: chunkSsmls.length,
    status: "Synthesizing"
  });

  for (const jobId of jobIds) {
    const finalJob: BatchSynthesisJob = await waitForBatchJob(jobId);
    if (finalJob.status !== "Succeeded") {
      const message = finalJob.properties?.error?.message ?? `Job ${jobId} failed`;
      throw new Error(message);
    }

    const result = finalJob.outputs?.result;
    if (!result) {
      throw new Error(`Job ${jobId} succeeded but returned no outputs.result`);
    }

    const resultUrl = resolveBatchResultUrl(result);
    const zipPath = path.join(outDir, `${jobId}.zip`);
    await downloadFile(resultUrl, zipPath);
    const audioPath = await extractFirstAudio(zipPath, path.join(outDir, jobId));
    audioPaths.push(audioPath);
  }

  return audioPaths;
};

export const runEpisodePipeline = async (episodeId: string, request: EpisodeRequest): Promise<void> => {
  try {
    const chunks = chunkTurns(request.script);
    const voiceConfig = defaultVoiceConfig();
    const chunkSsmls = chunks.map((chunk) => buildSsml(chunk, voiceConfig));

    const chunkAudioFiles = await processChunkJobs(episodeId, request, chunkSsmls);

    await episodeStore.update(episodeId, { status: "Stitching" });

    const finalLocalPath = await stitchAudio(
      episodeId,
      chunkAudioFiles,
      request.introMusicUrl,
      request.outroMusicUrl
    );

    const blobPath = `episodes/${episodeId}/final.mp3`;
    const finalAudioUrl = await uploadFinalAudio(finalLocalPath, blobPath);

    await episodeStore.update(episodeId, {
      status: "Completed",
      finalAudioUrl,
      finalBlobPath: blobPath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown synthesis error";
    await episodeStore.update(episodeId, {
      status: "Failed",
      error: message
    });
  }
};
