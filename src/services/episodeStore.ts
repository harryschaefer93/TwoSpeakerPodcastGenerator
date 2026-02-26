import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { EpisodeRecord, EpisodeStatus } from "../types.js";

const EPISODES_FILE = path.join(config.paths.dataDir, "episodes.json");

const ensureStore = async (): Promise<void> => {
  await fs.mkdir(config.paths.dataDir, { recursive: true });
  try {
    await fs.access(EPISODES_FILE);
  } catch {
    await fs.writeFile(EPISODES_FILE, JSON.stringify({ episodes: [] }, null, 2), "utf8");
  }
};

const readAll = async (): Promise<EpisodeRecord[]> => {
  await ensureStore();
  const raw = await fs.readFile(EPISODES_FILE, "utf8");
  const parsed = JSON.parse(raw) as { episodes: EpisodeRecord[] };
  return parsed.episodes;
};

const writeAll = async (episodes: EpisodeRecord[]): Promise<void> => {
  await ensureStore();
  await fs.writeFile(EPISODES_FILE, JSON.stringify({ episodes }, null, 2), "utf8");
};

export const episodeStore = {
  async insert(episode: EpisodeRecord): Promise<void> {
    const episodes = await readAll();
    episodes.push(episode);
    await writeAll(episodes);
  },

  async get(id: string): Promise<EpisodeRecord | undefined> {
    const episodes = await readAll();
    return episodes.find((item) => item.id === id);
  },

  async update(
    id: string,
    patch: Partial<EpisodeRecord> & { status?: EpisodeStatus; error?: string }
  ): Promise<EpisodeRecord | undefined> {
    const episodes = await readAll();
    const index = episodes.findIndex((item) => item.id === id);
    if (index < 0) {
      return undefined;
    }

    const current = episodes[index];
    const next: EpisodeRecord = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    episodes[index] = next;
    await writeAll(episodes);
    return next;
  }
};
