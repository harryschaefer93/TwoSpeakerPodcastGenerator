import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { getCredential } from "./identity.js";

/**
 * Lazily imports `@azure/storage-blob` to avoid a ~23 s cold-load penalty at
 * server startup in dev containers.
 */
const getStorageBlob = async () => import("@azure/storage-blob");

/**
 * Resolves a batch-result relative path to a full blob URL.
 *
 * If the result is already an absolute URL it is returned as-is.
 * Otherwise it is resolved against the OUTPUT_CONTAINER_URL.
 */
export const resolveBatchResultUrl = (result: string): string => {
  if (result.startsWith("http://") || result.startsWith("https://")) {
    return result;
  }

  const baseUrl = config.speech.outputContainerUrl.replace(/\/$/, "");
  const normalized = result.startsWith("/") ? result.slice(1) : result;
  return `${baseUrl}/${normalized}`;
};

export const uploadFinalAudio = async (
  localPath: string,
  blobPath: string,
  contentType = "audio/mpeg"
): Promise<string> => {
  const [credential, { ContainerClient }] = await Promise.all([
    getCredential(),
    getStorageBlob(),
  ]);
  const container = new ContainerClient(config.speech.outputContainerUrl, credential);
  const client = container.getBlockBlobClient(blobPath);
  const content = await fs.readFile(localPath);

  await client.uploadData(content, {
    blobHTTPHeaders: {
      blobContentType: contentType
    }
  });

  if (config.speech.outputContainerPublicBaseUrl) {
    const base = config.speech.outputContainerPublicBaseUrl.replace(/\/$/, "");
    const normalizedBlobPath = blobPath.replace(/^\//, "");
    return `${base}/${normalizedBlobPath}`;
  }

  return client.url;
};

/**
 * Downloads a file to disk.
 *
 * - Azure Blob Storage URLs (*.blob.core.windows.net) are downloaded via
 *   `@azure/storage-blob` with DefaultAzureCredential.
 * - All other URLs (e.g. service-managed SAS URLs returned by the batch
 *   synthesis API) are downloaded with a plain `fetch`.  If the URL already
 *   carries a SAS token no extra auth is added; otherwise a bearer token is
 *   attached.
 */
export const downloadFile = async (url: string, outPath: string): Promise<void> => {
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const isBlobStorageUrl = url.includes(".blob.core.windows.net");
  const hasSas = url.includes("sv=") || url.includes("sig=");

  // Use the Azure Storage SDK only for blob URLs that do NOT carry a
  // SAS token.  Batch-service-managed result URLs are blob.core URLs
  // with an embedded SAS — those must be fetched directly.
  if (isBlobStorageUrl && !hasSas) {
    const [credential, { BlobClient }] = await Promise.all([
      getCredential(),
      getStorageBlob(),
    ]);
    const blobClient = new BlobClient(url, credential);
    const response = await blobClient.download();

    if (!response.readableStreamBody) {
      throw new Error(`Failed to download file: no stream body returned for ${url}`);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of response.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    await fs.writeFile(outPath, Buffer.concat(chunks));
    return;
  }

  // Plain fetch — covers SAS URLs (blob or non-blob) and API URLs.
  const fetchHeaders: Record<string, string> = {};
  if (!hasSas) {
    const { getBearerToken } = await import("./identity.js");
    const token = await getBearerToken();
    fetchHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers: fetchHeaders });
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText} for ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outPath, buffer);
};
