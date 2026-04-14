import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export interface SourceDocument {
  id: string;
  filename: string;
  mimeType: string;
  extractedText: string;
  charCount: number;
  pageCount?: number;
  uploadedAt: string;
}

const SOURCES_DIR = path.join(config.paths.dataDir, "sources");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ensureDir = async (): Promise<void> => {
  await fs.mkdir(SOURCES_DIR, { recursive: true });
};

const filePath = (id: string): string => path.join(SOURCES_DIR, `${id}.json`);

export const sourceStore = {
  async insert(doc: SourceDocument): Promise<void> {
    await ensureDir();
    await fs.writeFile(filePath(doc.id), JSON.stringify(doc, null, 2), "utf8");
  },

  async get(id: string): Promise<SourceDocument | undefined> {
    if (!UUID_RE.test(id)) return undefined;
    try {
      const raw = await fs.readFile(filePath(id), "utf8");
      return JSON.parse(raw) as SourceDocument;
    } catch {
      return undefined;
    }
  },

  async delete(id: string): Promise<void> {
    if (!UUID_RE.test(id)) return;
    try {
      await fs.unlink(filePath(id));
    } catch {
      // already gone
    }
  },

  async list(): Promise<SourceDocument[]> {
    await ensureDir();
    const files = await fs.readdir(SOURCES_DIR);
    const docs: SourceDocument[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(SOURCES_DIR, file), "utf8");
        docs.push(JSON.parse(raw) as SourceDocument);
      } catch {
        // skip corrupt files
      }
    }
    return docs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },

  async cleanupOlderThan(hours: number): Promise<number> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const docs = await this.list();
    let removed = 0;
    for (const doc of docs) {
      if (new Date(doc.uploadedAt).getTime() < cutoff) {
        await this.delete(doc.id);
        removed++;
      }
    }
    return removed;
  },
};
