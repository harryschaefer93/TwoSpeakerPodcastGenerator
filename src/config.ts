import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  retry: {
    maxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS ?? 6),
    baseDelayMs: Number(process.env.RETRY_BASE_DELAY_MS ?? 500),
    maxDelayMs: Number(process.env.RETRY_MAX_DELAY_MS ?? 10000)
  },
  speech: {
    region: process.env.SPEECH_REGION ?? "",
    endpoint: process.env.SPEECH_ENDPOINT ?? "",
    apiVersion: process.env.SPEECH_API_VERSION ?? "2024-04-01",
    outputFormat: process.env.OUTPUT_AUDIO_FORMAT ?? "audio-24khz-48kbitrate-mono-mp3",
    outputContainerUrl: process.env.OUTPUT_CONTAINER_URL ?? "",
    outputContainerPublicBaseUrl: process.env.OUTPUT_CONTAINER_PUBLIC_BASE_URL ?? ""
  },
  voice: {
    useMultitalker: (process.env.USE_MULTITALKER ?? "true").toLowerCase() === "true",
    multitalkerVoice:
      process.env.MULTITALKER_VOICE ?? "en-US-MultiTalker-Ava-Andrew:DragonHDLatestNeural",
    speakerAAlias: process.env.SPEAKER_A_ALIAS ?? "ava",
    speakerBAlias: process.env.SPEAKER_B_ALIAS ?? "andrew",
    speakerAFallbackVoice:
      process.env.SPEAKER_A_FALLBACK_VOICE ?? "en-US-Ava:DragonHDOmniLatestNeural",
    speakerBFallbackVoice:
      process.env.SPEAKER_B_FALLBACK_VOICE ?? "en-US-Andrew:DragonHDOmniLatestNeural"
  },
  ai: {
    endpoint: process.env.AI_ENDPOINT ?? "",
    deployment: process.env.AI_DEPLOYMENT ?? "gpt-4.1",
    apiVersion: process.env.AI_API_VERSION ?? "2024-10-21"
  },
  media: {
    allowedHosts: (process.env.MEDIA_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  },
  security: {
    corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    authMode: (process.env.AUTH_MODE ?? "none").toLowerCase(),
    apiKeys: (process.env.API_KEYS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    jwtSecret: process.env.JWT_SECRET ?? "",
    jwtIssuer: process.env.JWT_ISSUER ?? "",
    jwtAudience: process.env.JWT_AUDIENCE ?? ""
  },
  paths: {
    dataDir: path.resolve(process.cwd(), "data"),
    tmpDir: path.resolve(process.cwd(), "tmp")
  }
};

export const assertSpeechConfig = (): void => {
  required("SPEECH_ENDPOINT");
  required("OUTPUT_CONTAINER_URL");
};
