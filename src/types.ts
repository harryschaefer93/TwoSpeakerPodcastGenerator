export type Speaker = "A" | "B";

export interface ScriptTurn {
  speaker: Speaker;
  text: string;
}

export interface EpisodeRequest {
  title?: string;
  script: ScriptTurn[];
  introMusicUrl?: string;
  outroMusicUrl?: string;
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
  finalBlobPath?: string;
  finalLocalPath?: string;
}

export interface ScriptGenerationRequest {
  topic: string;
  title?: string;
  tone?: string;
  targetMinutes?: number;
  /** Extracted text from an uploaded source document (document-grounded mode). */
  sourceText?: string;
  /** Ordered key themes for the discussion arc — produced by /scripts/themes. */
  themes?: string[];
}

export interface ScriptGenerationResponse {
  title: string;
  script: ScriptTurn[];
}

export interface VoiceConfig {
  useMultitalker: boolean;
  multitalkerVoice: string;
  speakerAAlias: string;
  speakerBAlias: string;
  speakerAFallbackVoice: string;
  speakerBFallbackVoice: string;
}
