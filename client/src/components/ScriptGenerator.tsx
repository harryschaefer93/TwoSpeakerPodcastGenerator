import { useState } from "react";
import { api, type ScriptGenerationResponse } from "../api";

interface Props {
  onGenerated: (result: ScriptGenerationResponse) => void;
}

export function ScriptGenerator({ onGenerated }: Props) {
  const [topic, setTopic] = useState("Azure AI trends for software teams");
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(10);
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
      });
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2>1. Generate Script</h2>
      <div className="form-row">
        <label>
          Topic
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's the podcast about?"
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
            min={8}
            max={20}
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
