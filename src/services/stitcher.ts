import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { downloadFile } from "./storage.js";

const execFileAsync = promisify(execFile);

const runFfmpeg = async (args: string[]): Promise<void> => {
  await execFileAsync("ffmpeg", args);
};

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
};

const validateRemoteAudioUrl = (source: string): URL => {
  const url = new URL(source);
  if (url.protocol !== "https:") {
    throw new Error("Only https URLs are allowed for intro/outro audio");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0" ||
    hostname === "169.254.169.254" ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error("Private or local network targets are not allowed for intro/outro audio");
  }

  if (config.media.allowedHosts.length > 0 && !config.media.allowedHosts.includes(hostname)) {
    throw new Error("Host is not in MEDIA_ALLOWED_HOSTS allowlist");
  }

  return url;
};

const normalizeSource = async (source: string, index: number, workDir: string): Promise<string> => {
  const wavPath = path.join(workDir, `normalized-${index}.wav`);

  if (source.startsWith("http://") || source.startsWith("https://")) {
    const safeUrl = validateRemoteAudioUrl(source);
    const downloaded = path.join(
      workDir,
      `source-${index}${path.extname(safeUrl.pathname) || ".bin"}`
    );
    await downloadFile(source, downloaded);
    await runFfmpeg(["-y", "-i", downloaded, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", wavPath]);
    return wavPath;
  }

  await runFfmpeg(["-y", "-i", source, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", wavPath]);
  return wavPath;
};

export const stitchAudio = async (
  episodeId: string,
  chunkAudioFiles: string[],
  introMusicUrl?: string,
  outroMusicUrl?: string
): Promise<string> => {
  await fs.mkdir(config.paths.tmpDir, { recursive: true });
  const workDir = path.join(config.paths.tmpDir, episodeId, "stitch");
  await fs.mkdir(workDir, { recursive: true });

  const sources: string[] = [];
  if (introMusicUrl) {
    sources.push(introMusicUrl);
  }
  sources.push(...chunkAudioFiles);
  if (outroMusicUrl) {
    sources.push(outroMusicUrl);
  }

  const normalized: string[] = [];
  for (let i = 0; i < sources.length; i += 1) {
    const file = await normalizeSource(sources[i], i, workDir);
    normalized.push(file);
  }

  const concatListPath = path.join(workDir, "concat.txt");
  const concatBody = normalized.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n");
  await fs.writeFile(concatListPath, concatBody, "utf8");

  const mergedWav = path.join(workDir, "merged.wav");
  const finalMp3 = path.join(config.paths.tmpDir, episodeId, "final.mp3");

  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", mergedWav]);
  await runFfmpeg(["-y", "-i", mergedWav, "-codec:a", "libmp3lame", "-b:a", "96k", finalMp3]);

  return finalMp3;
};
