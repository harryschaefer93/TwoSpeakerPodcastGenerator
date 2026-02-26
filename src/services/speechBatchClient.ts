import { config } from "../config.js";

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

const baseUrl = (): string =>
  `https://${config.speech.region}.api.cognitive.microsoft.com/texttospeech/batchsyntheses`;

const headers = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "Ocp-Apim-Subscription-Key": config.speech.key
});

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

export const createBatchSynthesisJob = async (jobId: string, ssmlInputs: string[]): Promise<BatchSynthesisJob> => {
  const url = `${baseUrl()}/${jobId}?api-version=${config.speech.apiVersion}`;
  const body = {
    description: `PodcastGen synthesis ${jobId}`,
    inputKind: "SSML",
    inputs: ssmlInputs.map((content) => ({ content })),
    properties: {
      outputFormat: config.speech.outputFormat,
      destinationContainerUrl: config.speech.outputContainerSasUrl,
      concatenateResult: false,
      decompressOutputFiles: true,
      wordBoundaryEnabled: false,
      sentenceBoundaryEnabled: false,
      timeToLiveInHours: 744
    }
  };

  const response = await fetchWithRetry(
    url,
    {
      method: "PUT",
      headers: headers(),
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
      headers: headers()
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
