import { config } from "../config.js";
import { getBearerToken } from "./identity.js";

export type BatchStatus = "NotStarted" | "Running" | "Succeeded" | "Failed";

export interface BatchSynthesisJob {
  id: string;
  status: BatchStatus;
  outputs?: {
    result?: string;
    summary?: string;
  };
  properties?: {
    error?: { code?: string; message?: string };
    failedAudioCount?: number;
    succeededAudioCount?: number;
  };
}

const baseUrl = (): string => {
  // Prefer the resource-specific custom-domain endpoint (required for Entra ID / bearer-token auth).
  // Fall back to the regional endpoint only when SPEECH_ENDPOINT is not set.
  const origin = config.speech.endpoint
    ? config.speech.endpoint.replace(/\/$/, "")
    : `https://${config.speech.region}.api.cognitive.microsoft.com`;
  return `${origin}/texttospeech/batchsyntheses`;
};

const headers = async (): Promise<Record<string, string>> => {
  const token = await getBearerToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isTransientStatus = (status: number): boolean => status === 408 || status === 429 || status >= 500;

const computeBackoffWithJitter = (attempt: number): number => {
  const exponentialDelay = Math.min(
    config.retry.maxDelayMs,
    config.retry.baseDelayMs * 2 ** Math.max(0, attempt - 1)
  );
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponentialDelay * 0.3)));
  return exponentialDelay + jitter;
};

const fetchWithRetry = async (
  url: string,
  init: RequestInit,
  operation: string
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.retry.maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!isTransientStatus(response.status) || attempt === config.retry.maxAttempts) {
        return response;
      }

      await sleep(computeBackoffWithJitter(attempt));
    } catch (error) {
      lastError = error;
      if (attempt === config.retry.maxAttempts) {
        break;
      }
      await sleep(computeBackoffWithJitter(attempt));
    }
  }

  throw new Error(
    `Failed to ${operation} after ${config.retry.maxAttempts} attempts${
      lastError instanceof Error ? `: ${lastError.message}` : ""
    }`
  );
};

const hasSasToken = (containerUrl: string): boolean => {
  try {
    const parsed = new URL(containerUrl);
    return parsed.searchParams.has("sv") || parsed.searchParams.has("sig");
  } catch {
    return false;
  }
};

export const createBatchSynthesisJob = async (jobId: string, ssmlInputs: string[]): Promise<BatchSynthesisJob> => {
  const url = `${baseUrl()}/${jobId}?api-version=${config.speech.apiVersion}`;

  const hasDestination = config.speech.outputContainerUrl && hasSasToken(config.speech.outputContainerUrl);

  const properties: Record<string, unknown> = {
    outputFormat: config.speech.outputFormat,
    concatenateResult: false,
    wordBoundaryEnabled: false,
    sentenceBoundaryEnabled: false,
    timeToLiveInHours: 744
  };

  // Only set destinationContainerUrl + decompressOutputFiles when
  // the URL includes a SAS token.  Without a SAS token the batch
  // service uses its own managed storage and returns a result URL.
  if (hasDestination) {
    properties.destinationContainerUrl = config.speech.outputContainerUrl;
    properties.decompressOutputFiles = true;
  }

  const body = {
    description: `PodcastGen synthesis ${jobId}`,
    inputKind: "SSML",
    inputs: ssmlInputs.map((content) => ({ content })),
    properties
  };

  const response = await fetchWithRetry(
    url,
    {
      method: "PUT",
      headers: await headers(),
      body: JSON.stringify(body)
    },
    `create batch synthesis job ${jobId}`
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to create batch synthesis job ${jobId}: ${response.status} ${message}`);
  }

  return (await response.json()) as BatchSynthesisJob;
};

export const getBatchSynthesisJob = async (jobId: string): Promise<BatchSynthesisJob> => {
  const url = `${baseUrl()}/${jobId}?api-version=${config.speech.apiVersion}`;
  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: await headers()
    },
    `get batch synthesis job ${jobId}`
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to get batch synthesis job ${jobId}: ${response.status} ${message}`);
  }

  return (await response.json()) as BatchSynthesisJob;
};

export const waitForBatchJob = async (
  jobId: string,
  intervalMs = 5000,
  timeoutMs = 1000 * 60 * 30
): Promise<BatchSynthesisJob> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await getBatchSynthesisJob(jobId);
    if (job.status === "Succeeded" || job.status === "Failed") {
      return job;
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for batch synthesis job ${jobId}`);
};
