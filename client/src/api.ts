export interface ScriptTurn {
  speaker: "A" | "B";
  text: string;
}

export interface ScriptGenerationRequest {
  topic: string;
  title?: string;
  tone?: string;
  targetMinutes?: number;
  documentId?: string;
  themes?: string[];
}

export interface ScriptGenerationResponse {
  title: string;
  script: ScriptTurn[];
}

export interface DocumentUploadResponse {
  documentId: string;
  filename: string;
  charCount: number;
  pageCount?: number;
}

export interface ThemesResponse {
  themes: string[];
}

export interface EpisodeCreateRequest {
  title?: string;
  script: ScriptTurn[];
  introMusicUrl?: string;
  outroMusicUrl?: string;
}

export interface EpisodeCreateResponse {
  episodeId: string;
  jobIds: string[];
  status: string;
}

export type EpisodeStatus =
  | "Draft"
  | "Queued"
  | "Synthesizing"
  | "Stitching"
  | "Completed"
  | "Failed";

export interface EpisodeRecord {
  id: string;
  title: string;
  status: EpisodeStatus;
  createdAt: string;
  updatedAt: string;
  script: ScriptTurn[];
  speechJobIds: string[];
  chunkCount: number;
  error?: string;
  finalAudioUrl?: string;
}

const jsonPost = async <T>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const msg = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
    throw new Error(msg ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
};

export const api = {
  async uploadDocument(file: File): Promise<DocumentUploadResponse> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/documents/upload", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const msg = typeof err.error === "string" ? err.error : JSON.stringify(err.error);
      throw new Error(msg ?? `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<DocumentUploadResponse>;
  },

  async extractThemes(documentId: string): Promise<ThemesResponse> {
    return jsonPost("/scripts/themes", { documentId });
  },

  generateScript(req: ScriptGenerationRequest): Promise<ScriptGenerationResponse> {
    return jsonPost("/scripts/generate", req);
  },

  createEpisode(req: EpisodeCreateRequest): Promise<EpisodeCreateResponse> {
    return jsonPost("/episodes", req);
  },

  async getEpisode(id: string): Promise<EpisodeRecord> {
    const res = await fetch(`/episodes/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `Request failed: ${res.status}`);
    }
    return res.json() as Promise<EpisodeRecord>;
  },

  async getDocument(id: string): Promise<{ documentId: string; filename: string; charCount: number; pageCount?: number; extractedText: string }> {
    const res = await fetch(`/documents/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `Request failed: ${res.status}`);
    }
    return res.json();
  },
};
