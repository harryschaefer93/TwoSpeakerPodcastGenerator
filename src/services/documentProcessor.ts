import type { Buffer } from "node:buffer";
import { PDFParse } from "pdf-parse";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export interface DocumentProcessingResult {
  text: string;
  charCount: number;
  pageCount?: number;
}

export const isSupportedMimeType = (mime: string): boolean =>
  SUPPORTED_MIME_TYPES.has(mime);

export const processDocument = async (
  buffer: Buffer,
  mimeType: string
): Promise<DocumentProcessingResult> => {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Accepted: PDF, plain text.`);
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Max: 20 MB.`);
  }

  if (mimeType === "application/pdf") {
    return extractPdf(buffer);
  }

  // Plain text fallback
  const text = buffer.toString("utf8").trim();
  return { text, charCount: text.length };
};

const extractPdf = async (buffer: Buffer): Promise<DocumentProcessingResult> => {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const textResult = await parser.getText();
    const text = textResult.text.trim();

    if (!text) {
      throw new Error("PDF contains no extractable text. Scanned/image-only PDFs are not supported.");
    }

    return {
      text,
      charCount: text.length,
      pageCount: textResult.total,
    };
  } finally {
    await parser.destroy();
  }
};
