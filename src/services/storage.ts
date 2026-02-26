import fs from "node:fs/promises";
import path from "node:path";
import { ContainerClient } from "@azure/storage-blob";
import { config } from "../config.js";

const parseSas = (sasUrl: string): { baseUrl: string; token: string } => {
  const url = new URL(sasUrl);
  return {
    baseUrl: `${url.origin}${url.pathname}`,
    token: url.search.replace(/^\?/, "")
  };
};

export const resolveBatchResultUrl = (result: string): string => {
  if (result.startsWith("http://") || result.startsWith("https://")) {
    return result;
  }

  const { baseUrl, token } = parseSas(config.speech.outputContainerSasUrl);
  const normalized = result.startsWith("/") ? result.slice(1) : result;
  return `${baseUrl}/${normalized}?${token}`;
};

export const uploadFinalAudio = async (
  localPath: string,
  blobPath: string,
  contentType = "audio/mpeg"
): Promise<string> => {
  const container = new ContainerClient(config.speech.outputContainerSasUrl);
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

export const downloadFile = async (url: string, outPath: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, data);
};
