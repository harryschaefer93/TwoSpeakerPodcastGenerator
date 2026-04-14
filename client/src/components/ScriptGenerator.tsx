import { useState } from "react";
import { api, type ScriptGenerationResponse } from "../api";

interface Props {
  onGenerated: (result: ScriptGenerationResponse) => void;
  documentId?: string;
  themes?: string[];
}

export function ScriptGenerator({ onGenerated, documentId, themes }: Props) {
  const isDocumentMode = Boolean(documentId);
  const [topic, setTopic] = useState(isDocumentMode ? "Discuss the uploaded document" : "Azure AI trends for software teams");
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await api.generateScript({
        topic,
        title: title || undefined,
        tone: tone || undefined,
        targetMinutes,
        documentId: documentId || undefined,
        themes: themes?.length ? themes : undefined,
      });
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const stepNumber = isDocumentMode ? 3 : 1;

  return (
    <section className="panel">
      <h2>{stepNumber}. Generate Script</h2>
      {isDocumentMode && (
        <p className="muted" style={{ marginBottom: 12 }}>
          The script will be grounded in your uploaded document{themes?.length ? ` with ${themes.length} themes guiding the discussion` : ""}.
        </p>
      )}
      <div className="form-row">
        <label>
          {isDocumentMode ? "Focus / angle" : "Topic"}
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={isDocumentMode ? "What angle should the hosts focus on?" : "What's the podcast about?"}
          />
        </label>
        <label>
          Title <span className="muted">(optional)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Episode title"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Tone <span className="muted">(optional)</span>
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. conversational, technical"
          />
        </label>
        <label>
          Duration (minutes)
          <input
            type="number"
            min={1}
            max={60}
            value={targetMinutes}
            onChange={(e) => setTargetMinutes(Number(e.target.value))}
          />
        </label>
      </div>
      <button onClick={handleGenerate} disabled={loading || topic.length < 3}>
        {loading ? "Generating…" : "Generate Script"}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
