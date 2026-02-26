export interface ScriptTurn {
  speaker: "A" | "B";
  text: string;
}

export interface ScriptGenerationRequest {
  topic: string;
  title?: string;
  tone?: string;
  targetMinutes?: number;
}

export interface ScriptGenerationResponse {
  title: string;
  script: ScriptTurn[];
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
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
};

export const api = {
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
};
