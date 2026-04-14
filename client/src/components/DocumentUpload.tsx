import { useState, useRef, type DragEvent } from "react";
import { api } from "../api";

interface Props {
  onDocumentReady: (result: DocumentUploadResponse) => void;
  onSkip: () => void;
}

export function DocumentUpload({ onDocumentReady, onSkip }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setSelectedFile({ name: file.name, size: file.size });
    setError("");
    setUploading(true);
    try {
      const res = await api.uploadDocument(file);
      onDocumentReady(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <section className="panel">
      <h2>1. Upload Source Document</h2>
      {!uploading && (
        <p className="muted" style={{ marginBottom: 12 }}>
          Upload a PDF or text file to generate a podcast discussion based on its content, or skip to create a topic-based podcast.
        </p>
      )}

      <div
        className={`drop-zone ${dragging ? "drop-zone-active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.text,application/pdf,text/plain"
          onChange={handleInputChange}
          style={{ display: "none" }}
        />
        {uploading && selectedFile ? (
          <span>Processing <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)…</span>
        ) : (
          <span>📄 Drop a file here or click to browse<br /><span className="muted">PDF or plain text, up to 20 MB</span></span>
        )}
      </div>

      <div style={{ textAlign: "center", margin: "12px 0" }}>
        <button className="btn-small" onClick={onSkip}>
          Or enter a topic manually →
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
